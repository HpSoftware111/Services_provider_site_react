import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ServiceRequest.css';

// Fix for default marker icons in Leaflet with Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ServiceRequest = () => {
    const navigate = useNavigate();
    const { user, checkAuth } = useContext(AuthContext);
    const [currentStep, setCurrentStep] = useState(1);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [loadingBusinesses, setLoadingBusinesses] = useState(false);
    const [loading, setLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [selectedBusinesses, setSelectedBusinesses] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [stepErrors, setStepErrors] = useState({});
    const [showBusinessModal, setShowBusinessModal] = useState(false);
    const [selectedBusinessDetail, setSelectedBusinessDetail] = useState(null);
    const [businessDetailLoading, setBusinessDetailLoading] = useState(false);
    const [monthlyUsage, setMonthlyUsage] = useState(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [phoneVerification, setPhoneVerification] = useState({
        phone: user?.phone || '',
        code: '',
        checked: false,
        verified: false,
        sending: false,
        verifying: false,
        error: '',
        info: ''
    });
    const [formData, setFormData] = useState({
        categoryId: '',
        subCategoryId: '',
        projectTitle: '',
        projectDescription: '',
        zipCode: user?.zipCode || '',
        preferredDate: '',
        preferredTime: '',
        attachments: [],
        selectedBusinessIds: []
    });

    const totalSteps = 5;

    useEffect(() => {
        loadCategories();
        loadMonthlyUsage();
    }, []);

    const loadMonthlyUsage = async () => {
        // Membership / monthly limits apply only to providers accepting leads,
        // NOT to customers submitting service requests.
        // For customer-facing ServiceRequest page we treat usage as unlimited.
        setMonthlyUsage(null);
            setUsageLoading(false);
    };

    // Check if a given phone number is already verified for the current user
    async function checkPhoneVerification(phoneToCheck) {
        if (!phoneToCheck) {
            setPhoneVerification(prev => ({
                ...prev,
                checked: true,
                verified: false,
                info: '',
                error: ''
            }));
            return;
        }
        try {
            const res = await api.get('/phone-verification/check-verification', {
                params: { phone: phoneToCheck }
            });
            const verified = !!res.data?.verified;
            setPhoneVerification(prev => ({
                ...prev,
                checked: true,
                verified,
                error: '',
                info: verified
                    ? 'Your phone number is verified.'
                    : 'Your phone number is not verified. Please request a code and verify it before submitting.'
            }));
        } catch (err) {
            console.error('Error checking phone verification:', err);
            setPhoneVerification(prev => ({
                ...prev,
                checked: true,
                verified: false,
                error: 'Could not check phone verification. Please try again.',
                info: ''
            }));
        }
    }

    useEffect(() => {
        if (formData.categoryId && categories.length > 0) {
            const category = categories.find(c => c.id === parseInt(formData.categoryId));
            if (category && category.subCategories) {
                setSubCategories(category.subCategories);
            } else {
                setSubCategories([]);
            }
        } else {
            setSubCategories([]);
        }
    }, [formData.categoryId, categories]);

    // When entering the booking step, ensure we know the current verification status
    useEffect(() => {
        if (currentStep === 5 && !phoneVerification.checked) {
            const phoneToCheck = phoneVerification.phone || user?.phone || '';
            if (phoneToCheck) {
                checkPhoneVerification(phoneToCheck);
            }
        }
    }, [currentStep, phoneVerification.checked, phoneVerification.phone, user]);

    // Load businesses when zip code, category, or subcategory changes on step 3
    useEffect(() => {
        if (currentStep === 3 && formData.zipCode && formData.zipCode.length >= 5 && formData.categoryId) {
            loadBusinessesByZipCode();
        } else if (currentStep === 3 && (!formData.categoryId || !formData.zipCode || formData.zipCode.length < 5)) {
            // Clear businesses if category or zip code is missing
            setBusinesses([]);
        }
    }, [currentStep, formData.zipCode, formData.categoryId, formData.subCategoryId]);

    const loadCategories = async () => {
        try {
            // Add cache-busting parameter to ensure fresh data
            const response = await api.get(`/service-requests/categories/all?t=${Date.now()}`);
            const categoriesData = response.data.categories || [];
            setCategories(categoriesData);
        } catch (error) {
            console.error('Error loading categories:', error);
            setMessage({ type: 'error', text: 'Failed to load categories' });
        } finally {
            setCategoriesLoading(false);
        }
    };

    const loadBusinessesByZipCode = async () => {
        // Don't load if zip code is invalid
        if (!formData.zipCode || formData.zipCode.length < 5) {
            setBusinesses([]);
            return;
        }

        // Don't load if category is missing
        if (!formData.categoryId) {
            setBusinesses([]);
            return;
        }

        // Note: subcategory is optional - if selected, we'll filter by it

        setLoadingBusinesses(true);
        try {
            // Filter businesses by zip code, category, and subcategory (if selected)
            const categoryId = parseInt(formData.categoryId);
            let apiUrl = `/businesses?zipCode=${formData.zipCode}&categoryId=${categoryId}&limit=20`;

            // Add subcategory filter if it's selected
            if (formData.subCategoryId) {
                const subCategoryId = parseInt(formData.subCategoryId);
                apiUrl += `&subCategory=${subCategoryId}`;
            }

            const response = await api.get(apiUrl);

            // Additional client-side filtering to ensure all businesses match:
            // 1. Category must match
            // 2. Subcategory must match (if subcategory was selected)
            // 3. Zip code must match
            let filteredBusinesses = (response.data.businesses || []).filter(business => {
                // Check category match
                if (business.categoryId !== categoryId) {
                    return false;
                }

                // Check subcategory match (if subcategory was selected)
                if (formData.subCategoryId) {
                    const subCategoryId = parseInt(formData.subCategoryId);
                    if (business.subCategoryId !== subCategoryId) {
                        return false;
                    }
                }

                // Check zip code match
                if (business.zipCode !== formData.zipCode) {
                    return false;
                }

                return true;
            });

            setBusinesses(filteredBusinesses);
        } catch (error) {
            console.error('Error loading businesses:', error);
            setBusinesses([]);
        } finally {
            setLoadingBusinesses(false);
        }
    };

    const handleViewBusinessDetail = async (businessId) => {
        setShowBusinessModal(true);
        setBusinessDetailLoading(true);
        setSelectedBusinessDetail(null);

        try {
            const response = await api.get(`/businesses/${businessId}`);
            if (response.data.success) {
                const business = response.data.business;
                // Ensure latitude and longitude are numbers or null
                if (business.latitude !== null && business.latitude !== undefined) {
                    business.latitude = parseFloat(business.latitude);
                }
                if (business.longitude !== null && business.longitude !== undefined) {
                    business.longitude = parseFloat(business.longitude);
                }
                setSelectedBusinessDetail(business);
            } else {
                setMessage({
                    type: 'error',
                    text: 'Failed to load business details'
                });
                setShowBusinessModal(false);
            }
        } catch (error) {
            console.error('Error loading business details:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to load business details'
            });
            setShowBusinessModal(false);
        } finally {
            setBusinessDetailLoading(false);
        }
    };

    const closeBusinessModal = () => {
        setShowBusinessModal(false);
        setSelectedBusinessDetail(null);
    };

    // --- Phone verification handlers ---
    const handlePhoneChange = (e) => {
        const value = e.target.value;
        setPhoneVerification(prev => ({
            ...prev,
            phone: value,
            code: '',
            verified: false,
            checked: false,
            error: '',
            info: ''
        }));
    };

    const handleSendVerificationCode = async () => {
        const phone = phoneVerification.phone.trim();
        if (!phone) {
            setPhoneVerification(prev => ({
                ...prev,
                error: 'Please enter your phone number before requesting a verification code.',
                info: ''
            }));
            return;
        }

        setPhoneVerification(prev => ({
            ...prev,
            sending: true,
            error: '',
            info: ''
        }));

        try {
            await api.post('/phone-verification/send-code', { phone });
            setPhoneVerification(prev => ({
                ...prev,
                sending: false,
                checked: false,
                verified: false,
                info: 'Verification code sent. Please check your email or SMS and enter the 6-digit code below.',
                error: ''
            }));
        } catch (err) {
            console.error('Error sending verification code:', err);
            setPhoneVerification(prev => ({
                ...prev,
                sending: false,
                error: err.response?.data?.error || 'Failed to send verification code. Please try again.',
                info: ''
            }));
        }
    };

    const handleVerifyCode = async () => {
        const phone = phoneVerification.phone.trim();
        const code = phoneVerification.code.trim();

        if (!phone) {
            setPhoneVerification(prev => ({
                ...prev,
                error: 'Please enter your phone number before verifying.',
                info: ''
            }));
            return;
        }

        if (!code) {
            setPhoneVerification(prev => ({
                ...prev,
                error: 'Please enter the verification code you received.',
                info: ''
            }));
            return;
        }

        setPhoneVerification(prev => ({
            ...prev,
            verifying: true,
            error: '',
            info: ''
        }));

        try {
            await api.post('/phone-verification/verify-code', { phone, code });
            // Refresh user data so phone is up to date
            if (typeof checkAuth === 'function') {
                try {
                    await checkAuth();
                } catch (e) {
                    // non-critical if this fails
                    console.warn('checkAuth after phone verification failed:', e);
                }
            }
            setPhoneVerification(prev => ({
                ...prev,
                verifying: false,
                verified: true,
                checked: true,
                error: '',
                info: 'Your phone number has been verified successfully.'
            }));
        } catch (err) {
            console.error('Error verifying phone code:', err);
            setPhoneVerification(prev => ({
                ...prev,
                verifying: false,
                verified: false,
                checked: true,
                error: err.response?.data?.error || 'Invalid or expired verification code. Please try again.',
                info: ''
            }));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Format zip code - only allow numbers and hyphen
        if (name === 'zipCode') {
            const formattedValue = value.replace(/[^0-9-]/g, '').slice(0, 10);
            setFormData({
                ...formData,
                [name]: formattedValue
            });
            return;
        }

        setFormData({
            ...formData,
            [name]: value
        });

        if (name === 'categoryId') {
            setFormData(prev => ({
                ...prev,
                categoryId: value,
                subCategoryId: ''
            }));
        }
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        processFiles(files);
    };

    const processFiles = (files) => {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        const newAttachments = imageFiles.map(file => ({
            name: file.name,
            url: URL.createObjectURL(file),
            file: file
        }));
        setFormData({
            ...formData,
            attachments: [...formData.attachments, ...newAttachments]
        });
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        processFiles(files);
    };

    const removeImage = (index) => {
        const newAttachments = formData.attachments.filter((_, i) => i !== index);
        setFormData({
            ...formData,
            attachments: newAttachments
        });
    };

    const validateStep = (step) => {
        const errors = {};

        switch (step) {
            case 1:
                if (!formData.categoryId || formData.categoryId === '') {
                    errors.categoryId = 'Please select a service category';
                }
                break;
            case 2:
                // Subcategory is optional, no validation needed
                break;
            case 3:
                if (!formData.zipCode || formData.zipCode.trim() === '') {
                    errors.zipCode = 'Zip code is required';
                } else if (formData.zipCode.length < 5) {
                    errors.zipCode = 'Zip code must be at least 5 characters';
                } else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode.trim())) {
                    errors.zipCode = 'Please enter a valid zip code (e.g., 12345 or 12345-6789)';
                }
                // Validate business selection - require at least one business if businesses are available and loaded
                // Only validate if zip code is valid and businesses have finished loading
                if (!errors.zipCode && formData.zipCode && formData.zipCode.length >= 5 && formData.categoryId) {
                    if (!loadingBusinesses && businesses.length > 0 && selectedBusinesses.length === 0) {
                        errors.selectedBusinesses = 'Please select at least one business to proceed';
                    }
                }
                break;
            case 4:
                if (!formData.projectTitle || formData.projectTitle.trim() === '') {
                    errors.projectTitle = 'Project title is required';
                } else if (formData.projectTitle.trim().length < 3) {
                    errors.projectTitle = 'Project title must be at least 3 characters';
                } else if (formData.projectTitle.trim().length > 255) {
                    errors.projectTitle = 'Project title must be less than 255 characters';
                }

                if (!formData.projectDescription || formData.projectDescription.trim() === '') {
                    errors.projectDescription = 'Project description is required';
                } else if (formData.projectDescription.trim().length < 10) {
                    errors.projectDescription = 'Project description must be at least 10 characters';
                } else if (formData.projectDescription.trim().length > 5000) {
                    errors.projectDescription = 'Project description must be less than 5000 characters';
                }
                break;
            case 5:
                // Date validation - REQUIRED
                if (!formData.preferredDate || formData.preferredDate.trim() === '') {
                    errors.preferredDate = 'Preferred date is required';
                } else {
                    const selectedDate = new Date(formData.preferredDate + 'T00:00:00');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (isNaN(selectedDate.getTime())) {
                        errors.preferredDate = 'Please enter a valid date';
                    } else if (selectedDate < today) {
                        errors.preferredDate = 'Preferred date cannot be in the past';
                    } else {
                        // Check if date is too far in the future (e.g., more than 1 year)
                        const oneYearFromNow = new Date();
                        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                        if (selectedDate > oneYearFromNow) {
                            errors.preferredDate = 'Preferred date cannot be more than 1 year in the future';
                        }
                    }
                }

                // Time validation - optional but validate if provided
                if (formData.preferredTime && formData.preferredTime.trim() !== '') {
                    // If date is today, validate that time is not in the past
                    if (formData.preferredDate) {
                        const selectedDate = new Date(formData.preferredDate + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        const isToday = selectedDate.getTime() === today.getTime();

                        if (isToday) {
                            const now = new Date();
                            const currentHour = now.getHours();
                            const currentMinute = now.getMinutes();

                            // Extract time from preferredTime string (format: "Morning (8am - 12pm)" or "Afternoon (12pm - 5pm)" etc.)
                            // Skip validation for "Flexible" option
                            if (formData.preferredTime !== 'Flexible') {
                                const timeRanges = {
                                    'Morning (8am - 12pm)': { start: 8, end: 12 },
                                    'Afternoon (12pm - 5pm)': { start: 12, end: 17 },
                                    'Evening (5pm - 8pm)': { start: 17, end: 20 },
                                    'Night (8pm - 11pm)': { start: 20, end: 23 }
                                };

                                const selectedTimeRange = timeRanges[formData.preferredTime];
                                if (selectedTimeRange) {
                                    // Check if the selected time range has already passed today
                                    if (currentHour >= selectedTimeRange.end) {
                                        errors.preferredTime = 'This time slot has already passed today. Please select a later time or choose "Flexible".';
                                    } else if (currentHour >= selectedTimeRange.start) {
                                        // If we're in the middle of the time range, check if there's enough time left
                                        const minutesRemaining = (selectedTimeRange.end - currentHour) * 60 - currentMinute;
                                        if (minutesRemaining < 30) {
                                            errors.preferredTime = 'This time slot is ending soon (less than 30 minutes). Please select a later time or choose "Flexible".';
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Validate time format/selection
                    const validTimeSlots = [
                        'Morning (8am - 12pm)',
                        'Afternoon (12pm - 5pm)',
                        'Evening (5pm - 8pm)',
                        'Night (8pm - 11pm)',
                        'Flexible'
                    ];

                    if (!validTimeSlots.includes(formData.preferredTime)) {
                        errors.preferredTime = 'Please select a valid time slot';
                    }
                }
                break;
            default:
                break;
        }

        setStepErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                setCurrentStep(currentStep + 1);
                setMessage({ type: '', text: '' });
                // Clear errors for the current step when moving forward
                setStepErrors({});
            }
        } else {
            const errorMessages = Object.values(stepErrors);
            if (errorMessages.length > 0) {
                setMessage({ type: 'error', text: errorMessages[0] });
            } else {
                setMessage({ type: 'error', text: 'Please complete the required fields before proceeding' });
            }
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setMessage({ type: '', text: '' });
            // Clear errors when going back
            setStepErrors({});
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        // Ensure phone number is present and verified before allowing submission
        const phoneToUse = (phoneVerification.phone || user?.phone || '').trim();
        if (!phoneToUse) {
            setMessage({
                type: 'error',
                text: 'Please enter your phone number and complete phone verification before submitting your request.'
            });
            setLoading(false);
            return;
        }

        if (!phoneVerification.verified) {
            setMessage({
                type: 'error',
                text: 'Please verify your phone number before submitting your service request.'
            });
            setLoading(false);
            return;
        }

        // Validate all steps before submission (including step 5 - booking date)
        let isValid = true;
        for (let step = 1; step <= 5; step++) {
            if (!validateStep(step)) {
                isValid = false;
                if (step < currentStep) {
                    // If validation fails on a previous step, go back to that step
                    setCurrentStep(step);
                } else if (step === 5 && currentStep === 5) {
                    // If we're on step 5 and validation fails, show error
                    const errorMessages = Object.values(stepErrors);
                    if (errorMessages.length > 0) {
                        setMessage({ type: 'error', text: errorMessages[0] });
                    }
                }
                break;
            }
        }

        if (!isValid) {
            const errorMessages = Object.values(stepErrors);
            if (errorMessages.length > 0) {
                setMessage({ type: 'error', text: errorMessages[0] });
            } else {
                setMessage({ type: 'error', text: 'Please complete all required fields' });
            }
            setLoading(false);
            return;
        }

        // NOTE: We DO NOT enforce any monthly limit for customers here.
        // Membership is only for providers accepting leads, so customers
        // can submit unlimited service requests.

        try {
            // Convert file objects to base64 or prepare for upload
            const attachmentsData = await Promise.all(
                formData.attachments.map(async (attachment) => {
                    if (attachment.file) {
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                resolve({
                                    name: attachment.name,
                                    data: reader.result
                                });
                            };
                            reader.readAsDataURL(attachment.file);
                        });
                    }
                    return attachment;
                })
            );

            const submitData = {
                ...formData,
                // Convert empty string to null for subCategoryId
                subCategoryId: formData.subCategoryId === '' ? null : formData.subCategoryId,
                // Include selected business IDs
                selectedBusinessIds: selectedBusinesses,
                attachments: attachmentsData
            };

            await api.post('/service-requests', submitData);

            setMessage({
                type: 'success',
                text: 'Service request submitted successfully! We will connect you with providers soon.'
            });

            setTimeout(() => {
                navigate('/user-dashboard');
            }, 2000);
        } catch (error) {
                setMessage({
                    type: 'error',
                    text: error.response?.data?.error || 'Failed to submit service request'
                });
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="service-request-page">
                <div className="container">
                    <div className="login-required">
                        <i className="fas fa-lock"></i>
                        <h2>Login Required</h2>
                        <p>Please login to request a service</p>
                        <button onClick={() => navigate('/login')} className="btn-primary">
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="step-content">
                        <h2>Select Service</h2>
                        <p className="step-description">Choose the primary service category you need</p>
                        <div className="form-group">
                            <label htmlFor="categoryId">Service Category *</label>
                            {categoriesLoading ? (
                                <div className="loading-select">Loading categories...</div>
                            ) : (
                                <>
                                    <div className={`category-grid ${stepErrors.categoryId ? 'has-error' : ''}`}>
                                        {categories.map((category) => (
                                            <div
                                                key={category.id}
                                                className={`category-option ${formData.categoryId === category.id.toString() ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        categoryId: category.id.toString(),
                                                        subCategoryId: ''
                                                    }));
                                                    // Clear error when category is selected
                                                    if (stepErrors.categoryId) {
                                                        setStepErrors(prev => {
                                                            const newErrors = { ...prev };
                                                            delete newErrors.categoryId;
                                                            return newErrors;
                                                        });
                                                    }
                                                }}
                                            >
                                                <i
                                                    className={`fas fa-${category.icon || 'tools'}`}
                                                    title={`${category.name} - Icon: ${category.icon || 'default'}`}
                                                ></i>
                                                <span>{category.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {stepErrors.categoryId && (
                                        <div className="field-error">
                                            <i className="fas fa-exclamation-circle"></i>
                                            <span>{stepErrors.categoryId}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="step-content">
                        <h2>Select Sub-Service</h2>
                        <p className="step-description">Choose the specific sub-service (optional)</p>
                        {subCategories.length > 0 ? (
                            <div className="form-group">
                                <label>Sub-Service (Optional)</label>
                                <div className="subcategory-grid">
                                    <div
                                        className={`subcategory-option ${formData.subCategoryId === '' ? 'selected' : ''}`}
                                        onClick={() => setFormData(prev => ({ ...prev, subCategoryId: '' }))}
                                    >
                                        <span>None / Skip</span>
                                    </div>
                                    {subCategories.map((subCategory) => (
                                        <div
                                            key={subCategory.id}
                                            className={`subcategory-option ${formData.subCategoryId === subCategory.id.toString() ? 'selected' : ''}`}
                                            onClick={() => setFormData(prev => ({ ...prev, subCategoryId: subCategory.id.toString() }))}
                                        >
                                            <span>{subCategory.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="no-subcategories">
                                <i className="fas fa-info-circle"></i>
                                <p>No subcategories available for this service. You can proceed to the next step.</p>
                            </div>
                        )}
                    </div>
                );

            case 3:
                return (
                    <div className="step-content">
                        <h2>Enter Zip Code</h2>
                        <p className="step-description">Enter your zip code to see available service providers in your area</p>
                        <div className="form-group">
                            <label htmlFor="zipCode">Zip Code *</label>
                            <div className={`zip-code-input-wrapper ${stepErrors.zipCode ? 'has-error' : ''}`}>
                                <i className="fas fa-map-marker-alt zip-code-icon"></i>
                                <input
                                    type="text"
                                    id="zipCode"
                                    name="zipCode"
                                    value={formData.zipCode}
                                    onChange={(e) => {
                                        handleChange(e);
                                        // Clear error when user starts typing
                                        if (stepErrors.zipCode) {
                                            setStepErrors(prev => {
                                                const newErrors = { ...prev };
                                                delete newErrors.zipCode;
                                                return newErrors;
                                            });
                                        }
                                    }}
                                    placeholder="Enter your zip code (e.g., 10001)"
                                    required
                                    maxLength="10"
                                    pattern="[0-9]{5}(-[0-9]{4})?"
                                    inputMode="numeric"
                                />
                            </div>
                            {stepErrors.zipCode ? (
                                <div className="field-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{stepErrors.zipCode}</span>
                                </div>
                            ) : (
                                <small className="form-hint">Enter a 5-digit zip code</small>
                            )}
                        </div>
                        {formData.zipCode && formData.zipCode.length >= 5 && formData.categoryId ? (
                            <div className="businesses-section">
                                <h3>
                                    Available {categories.find(c => c.id === parseInt(formData.categoryId))?.name || 'Service'}
                                    {formData.subCategoryId && subCategories.find(s => s.id === parseInt(formData.subCategoryId)) && (
                                        <> - {subCategories.find(s => s.id === parseInt(formData.subCategoryId))?.name}</>
                                    )} Businesses in {formData.zipCode}
                                </h3>
                                {loadingBusinesses ? (
                                    <div className="loading-businesses">
                                        <i className="fas fa-spinner fa-spin"></i> Loading businesses...
                                    </div>
                                ) : businesses.length > 0 ? (
                                    <>
                                        <div className={`business-selection-hint ${stepErrors.selectedBusinesses ? 'has-error' : ''}`}>
                                            <i className={`fas fa-${stepErrors.selectedBusinesses ? 'exclamation-circle' : 'info-circle'}`}></i>
                                            <span>
                                                {stepErrors.selectedBusinesses
                                                    ? stepErrors.selectedBusinesses
                                                    : 'Select at least one business you\'d like to contact *'}
                                            </span>
                                        </div>
                                        {stepErrors.selectedBusinesses && (
                                            <div className="field-error" style={{ marginTop: '8px', marginBottom: '16px' }}>
                                                <i className="fas fa-exclamation-circle"></i>
                                                <span>{stepErrors.selectedBusinesses}</span>
                                            </div>
                                        )}
                                        <div className="businesses-grid">
                                            {businesses.map((business) => {
                                                const isSelected = selectedBusinesses.includes(business.id);
                                                return (
                                                    <div
                                                        key={business.id}
                                                        className={`business-card ${isSelected ? 'selected' : ''}`}
                                                    >
                                                        <div
                                                            className="business-card-content"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedBusinesses(prev => prev.filter(id => id !== business.id));
                                                                } else {
                                                                    setSelectedBusinesses(prev => [...prev, business.id]);
                                                                }
                                                                // Clear error when user selects a business
                                                                if (stepErrors.selectedBusinesses) {
                                                                    setStepErrors(prev => {
                                                                        const newErrors = { ...prev };
                                                                        delete newErrors.selectedBusinesses;
                                                                        return newErrors;
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <div className="business-card-checkbox">
                                                                <i className={`fas fa-${isSelected ? 'check-circle' : 'circle'}`}></i>
                                                            </div>
                                                            <div className="business-card-header">
                                                                <h4>{business.name}</h4>
                                                                {business.ratingAverage > 0 && (
                                                                    <div className="business-rating">
                                                                        <span className="stars">{'★'.repeat(Math.floor(parseFloat(business.ratingAverage) || 0))}</span>
                                                                        <span className="rating-value">{parseFloat(business.ratingAverage).toFixed(1)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="business-description">{business.description?.substring(0, 100)}...</p>
                                                            <div className="business-info">
                                                                <p><i className="fas fa-map-marker-alt"></i> {business.city}, {business.state}</p>
                                                                {business.phone && <p><i className="fas fa-phone"></i> {business.phone}</p>}
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="business-view-detail-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewBusinessDetail(business.id);
                                                            }}
                                                        >
                                                            <i className="fas fa-eye"></i>
                                                            View Detail
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {selectedBusinesses.length > 0 && (
                                            <div className="selected-businesses-count">
                                                <i className="fas fa-check"></i>
                                                <span>{selectedBusinesses.length} business{selectedBusinesses.length !== 1 ? 'es' : ''} selected</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="no-businesses">
                                        <i className="fas fa-info-circle"></i>
                                        <p>
                                            No {categories.find(c => c.id === parseInt(formData.categoryId))?.name?.toLowerCase() || 'service'}
                                            {formData.subCategoryId && subCategories.find(s => s.id === parseInt(formData.subCategoryId)) && (
                                                <> - {subCategories.find(s => s.id === parseInt(formData.subCategoryId))?.name?.toLowerCase()}</>
                                            )} businesses found matching:
                                            <br />
                                            • Category: {categories.find(c => c.id === parseInt(formData.categoryId))?.name || 'N/A'}
                                            {formData.subCategoryId && subCategories.find(s => s.id === parseInt(formData.subCategoryId)) && (
                                                <>
                                                    <br />• Subcategory: {subCategories.find(s => s.id === parseInt(formData.subCategoryId))?.name || 'N/A'}
                                                </>
                                            )}
                                            <br />• Zip Code: {formData.zipCode}
                                            <br />
                                            <br />
                                            You can still proceed with your request.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : formData.zipCode && formData.zipCode.length >= 5 && !formData.categoryId ? (
                            <div className="no-businesses">
                                <i className="fas fa-exclamation-triangle"></i>
                                <p>Please go back and select a service category first to see available businesses.</p>
                            </div>
                        ) : null}
                    </div>
                );

            case 4:
                return (
                    <div className="step-content">
                        <h2>Project Details</h2>
                        <p className="step-description">Provide details about your project and upload relevant images</p>
                        <div className="form-group">
                            <label htmlFor="projectTitle">Project Title *</label>
                            <input
                                type="text"
                                id="projectTitle"
                                name="projectTitle"
                                value={formData.projectTitle}
                                onChange={(e) => {
                                    handleChange(e);
                                    // Clear error when user starts typing
                                    if (stepErrors.projectTitle) {
                                        setStepErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors.projectTitle;
                                            return newErrors;
                                        });
                                    }
                                }}
                                className={stepErrors.projectTitle ? 'has-error' : ''}
                                placeholder="e.g., Fix leaking kitchen faucet"
                                maxLength="255"
                                required
                            />
                            {stepErrors.projectTitle && (
                                <div className="field-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{stepErrors.projectTitle}</span>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label htmlFor="projectDescription">Project Description *</label>
                            <textarea
                                id="projectDescription"
                                name="projectDescription"
                                value={formData.projectDescription}
                                onChange={(e) => {
                                    handleChange(e);
                                    // Clear error when user starts typing
                                    if (stepErrors.projectDescription) {
                                        setStepErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors.projectDescription;
                                            return newErrors;
                                        });
                                    }
                                }}
                                className={stepErrors.projectDescription ? 'has-error' : ''}
                                rows="6"
                                placeholder="Describe the service you need in detail..."
                                maxLength="5000"
                                required
                            />
                            <div className="char-count">
                                {formData.projectDescription.length} / 5000 characters
                            </div>
                            {stepErrors.projectDescription && (
                                <div className="field-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{stepErrors.projectDescription}</span>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label htmlFor="attachments">Upload Images (Optional)</label>
                            <div
                                className={`image-upload-section ${isDragging ? 'dragging' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="attachments"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="file-input"
                                />
                                <label htmlFor="attachments" className="file-input-label">
                                    <i className="fas fa-cloud-upload-alt"></i>
                                    <span>Choose Images or Drag & Drop</span>
                                </label>
                                {formData.attachments.length > 0 && (
                                    <div className="uploaded-images">
                                        {formData.attachments.map((attachment, index) => (
                                            <div key={index} className="image-preview">
                                                <img src={attachment.url} alt={attachment.name} />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="remove-image-btn"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div className="step-content">
                        <h2>Booking Date</h2>
                        <p className="step-description">Select your preferred date and time for the service</p>
                        {/* Phone verification section */}
                        <div className="form-group">
                            <h3>Phone Verification</h3>
                            <p className="step-description">
                                We require a verified phone number so providers can contact you about this request.
                            </p>
                            <label htmlFor="customerPhone">Phone Number *</label>
                            <input
                                type="tel"
                                id="customerPhone"
                                name="customerPhone"
                                value={phoneVerification.phone}
                                onChange={handlePhoneChange}
                                placeholder="Enter your mobile number"
                                disabled={phoneVerification.sending || phoneVerification.verifying}
                            />
                            {phoneVerification.error && (
                                <div className="field-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{phoneVerification.error}</span>
                                </div>
                            )}
                            {phoneVerification.info && !phoneVerification.error && (
                                <div className="field-info">
                                    <i className="fas fa-info-circle"></i>
                                    <span>{phoneVerification.info}</span>
                                </div>
                            )}
                            <div className="phone-verification-actions" style={{ marginTop: '8px', marginBottom: '8px' }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleSendVerificationCode}
                                    disabled={phoneVerification.sending || !phoneVerification.phone}
                                >
                                    {phoneVerification.sending ? 'Sending code...' : 'Send verification code'}
                                </button>
                            </div>
                            <div className="form-group" style={{ marginTop: '8px' }}>
                                <label htmlFor="verificationCode">Verification Code</label>
                                <input
                                    type="text"
                                    id="verificationCode"
                                    name="verificationCode"
                                    value={phoneVerification.code}
                                    onChange={(e) =>
                                        setPhoneVerification(prev => ({ ...prev, code: e.target.value }))
                                    }
                                    placeholder="Enter the 6-digit code"
                                    disabled={phoneVerification.verifying}
                                />
                                <button
                                    type="button"
                                    className="btn-primary"
                                    style={{ marginTop: '8px' }}
                                    onClick={handleVerifyCode}
                                    disabled={phoneVerification.verifying || !phoneVerification.code}
                                >
                                    {phoneVerification.verifying ? 'Verifying...' : 'Verify code'}
                                </button>
                            </div>
                            {phoneVerification.verified && (
                                <div className="field-success" style={{ marginTop: '8px' }}>
                                    <i className="fas fa-check-circle"></i>
                                    <span>Your phone number is verified.</span>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label htmlFor="preferredDate">Preferred Date *</label>
                            <input
                                type="date"
                                id="preferredDate"
                                name="preferredDate"
                                value={formData.preferredDate}
                                onChange={(e) => {
                                    handleChange(e);
                                    // Clear error when user selects a date
                                    if (stepErrors.preferredDate) {
                                        setStepErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors.preferredDate;
                                            return newErrors;
                                        });
                                    }
                                    // Also clear time error if date changes and time was invalid
                                    if (stepErrors.preferredTime && formData.preferredTime) {
                                        // Re-validate time when date changes
                                        setTimeout(() => {
                                            validateStep(5);
                                        }, 100);
                                    }
                                }}
                                className={stepErrors.preferredDate ? 'has-error' : ''}
                                min={new Date().toISOString().split('T')[0]}
                                max={(() => {
                                    const maxDate = new Date();
                                    maxDate.setFullYear(maxDate.getFullYear() + 1);
                                    return maxDate.toISOString().split('T')[0];
                                })()}
                                required
                            />
                            {stepErrors.preferredDate && (
                                <div className="field-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{stepErrors.preferredDate}</span>
                                </div>
                            )}
                            {!stepErrors.preferredDate && (
                                <small className="form-hint">
                                    <i className="fas fa-info-circle"></i>
                                    You can select a date up to 1 year in the future
                                </small>
                            )}
                        </div>
                        <div className="form-group">
                            <label htmlFor="preferredTime">Preferred Time (Optional)</label>
                            <select
                                id="preferredTime"
                                name="preferredTime"
                                value={formData.preferredTime}
                                onChange={(e) => {
                                    handleChange(e);
                                    // Clear error when user selects a time
                                    if (stepErrors.preferredTime) {
                                        setStepErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors.preferredTime;
                                            return newErrors;
                                        });
                                    }
                                }}
                                className={stepErrors.preferredTime ? 'has-error' : ''}
                            >
                                <option value="">Select preferred time</option>
                                <option value="Morning (8am - 12pm)">Morning (8am - 12pm)</option>
                                <option value="Afternoon (12pm - 5pm)">Afternoon (12pm - 5pm)</option>
                                <option value="Evening (5pm - 8pm)">Evening (5pm - 8pm)</option>
                                <option value="Flexible">Flexible</option>
                            </select>
                            {stepErrors.preferredTime && (
                                <div className="field-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{stepErrors.preferredTime}</span>
                                </div>
                            )}
                        </div>
                        <div className="review-summary">
                            <h3>Review Your Request</h3>
                            <div className="summary-item">
                                <strong>Service:</strong> {categories.find(c => c.id === parseInt(formData.categoryId))?.name || 'N/A'}
                            </div>
                            {formData.subCategoryId && (
                                <div className="summary-item">
                                    <strong>Sub-Service:</strong> {subCategories.find(sc => sc.id === parseInt(formData.subCategoryId))?.name || 'N/A'}
                                </div>
                            )}
                            <div className="summary-item">
                                <strong>Zip Code:</strong> {formData.zipCode}
                            </div>
                            <div className="summary-item">
                                <strong>Project Title:</strong> {formData.projectTitle}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="service-request-page">
            <div className="container">
                {/* No monthly usage banner here for customers; they can submit unlimited requests */}
                <div className="page-header">
                    <h1>Request a Service</h1>
                    <p>Follow the steps below to submit your service request</p>
                </div>

                {/* Progress Indicator */}
                <div className="progress-indicator">
                    {[1, 2, 3, 4, 5].map((step) => (
                        <React.Fragment key={step}>
                            <div className={`progress-step ${step <= currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}>
                                <div className="step-number">{step}</div>
                                <div className="step-label">
                                    {step === 1 && 'Service'}
                                    {step === 2 && 'Sub-Service'}
                                    {step === 3 && 'Zip Code'}
                                    {step === 4 && 'Details'}
                                    {step === 5 && 'Booking'}
                                </div>
                            </div>
                            {step < totalSteps && <div className={`progress-line ${step < currentStep ? 'completed' : ''}`}></div>}
                        </React.Fragment>
                    ))}
                </div>

                {message.text && (
                    <div className={`alert alert-${message.type}`}>
                        <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                        <span>{message.text}</span>
                        <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}

                <div className="service-request-form wizard-form">
                    {renderStepContent()}

                    <div className="form-actions wizard-actions">
                        {currentStep > 1 && (
                            <button type="button" onClick={handlePrevious} className="btn-secondary">
                                <i className="fas fa-arrow-left"></i>
                                <span>Previous</span>
                            </button>
                        )}
                        <div className="wizard-actions-right">
                            {currentStep < totalSteps ? (
                                <button type="button" onClick={handleNext} className="btn-primary">
                                    <span>Next</span>
                                    <i className="fas fa-arrow-right"></i>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="btn-primary"
                                    disabled={loading || !phoneVerification.verified}
                                >
                                    {loading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin"></i> <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-paper-plane"></i>{' '}
                                            <span>
                                                {phoneVerification.verified
                                                    ? 'Submit Request'
                                                    : 'Verify Phone to Submit'}
                                            </span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Business Detail Modal */}
            {showBusinessModal && (
                <div className="modal-overlay" onClick={closeBusinessModal}>
                    <div className="modal-content business-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-store"></i>
                                Business Details
                            </h2>
                            <button className="modal-close" onClick={closeBusinessModal}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            {businessDetailLoading ? (
                                <div className="modal-loading">
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <p>Loading business details...</p>
                                </div>
                            ) : selectedBusinessDetail ? (
                                <div className="business-detail-content">
                                    {/* Business Name and Rating */}
                                    <div className="business-detail-header">
                                        <h3>{selectedBusinessDetail.name}</h3>
                                        {selectedBusinessDetail.ratingAverage > 0 && (
                                            <div className="business-rating-large">
                                                <div className="stars-large">
                                                    {'★'.repeat(Math.floor(parseFloat(selectedBusinessDetail.ratingAverage) || 0))}
                                                    {'☆'.repeat(5 - Math.floor(parseFloat(selectedBusinessDetail.ratingAverage) || 0))}
                                                </div>
                                                <span className="rating-value-large">
                                                    {parseFloat(selectedBusinessDetail.ratingAverage).toFixed(1)}
                                                    <span className="rating-count">({selectedBusinessDetail.ratingCount || 0} reviews)</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Position/Address */}
                                    <div className="detail-section">
                                        <h4>
                                            <i className="fas fa-map-marker-alt"></i>
                                            Location
                                        </h4>
                                        <div className="detail-info">
                                            <p><strong>Address:</strong> {selectedBusinessDetail.address}</p>
                                            <p><strong>City:</strong> {selectedBusinessDetail.city}, {selectedBusinessDetail.state}</p>
                                            {selectedBusinessDetail.zipCode && (
                                                <p><strong>Zip Code:</strong> {selectedBusinessDetail.zipCode}</p>
                                            )}
                                        </div>

                                        {/* OpenStreetMap with Leaflet (Free, No API Key Required) */}
                                        {(() => {
                                            // Try to get coordinates from business data or geocode from address
                                            const lat = selectedBusinessDetail.latitude ? parseFloat(selectedBusinessDetail.latitude) : null;
                                            const lng = selectedBusinessDetail.longitude ? parseFloat(selectedBusinessDetail.longitude) : null;

                                            // If coordinates exist, show map
                                            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                                                return (
                                                    <div className="business-map-container">
                                                        <MapContainer
                                                            center={[lat, lng]}
                                                            zoom={15}
                                                            style={{ height: '300px', width: '100%', borderRadius: '8px' }}
                                                            scrollWheelZoom={true}
                                                        >
                                                            <TileLayer
                                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                            />
                                                            <Marker
                                                                position={[lat, lng]}
                                                            >
                                                                <Popup>
                                                                    <strong>{selectedBusinessDetail.name}</strong><br />
                                                                    {selectedBusinessDetail.address}<br />
                                                                    {selectedBusinessDetail.city}, {selectedBusinessDetail.state}
                                                                </Popup>
                                                            </Marker>
                                                        </MapContainer>
                                                    </div>
                                                );
                                            }

                                            // If no coordinates, show OpenStreetMap link with address search
                                            const address = `${selectedBusinessDetail.address}, ${selectedBusinessDetail.city}, ${selectedBusinessDetail.state} ${selectedBusinessDetail.zipCode || ''}`.trim();
                                            const mapUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;

                                            return (
                                                <div className="business-map-container">
                                                    <div style={{
                                                        height: '300px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: '#f3f4f6',
                                                        borderRadius: '8px',
                                                        padding: '20px',
                                                        textAlign: 'center',
                                                        border: '2px dashed #d1d5db'
                                                    }}>
                                                        <i className="fas fa-map-marker-alt" style={{
                                                            fontSize: '48px',
                                                            marginBottom: '16px',
                                                            color: '#667eea'
                                                        }}></i>
                                                        <p style={{
                                                            color: '#374151',
                                                            fontSize: '15px',
                                                            marginBottom: '8px',
                                                            fontWeight: '600'
                                                        }}>
                                                            View Location on Map
                                                        </p>
                                                        <p style={{
                                                            color: '#6b7280',
                                                            fontSize: '13px',
                                                            marginBottom: '20px',
                                                            lineHeight: '1.5'
                                                        }}>
                                                            {address}
                                                        </p>
                                                        <a
                                                            href={mapUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                padding: '10px 20px',
                                                                background: '#667eea',
                                                                color: 'white',
                                                                textDecoration: 'none',
                                                                borderRadius: '8px',
                                                                fontWeight: '600',
                                                                fontSize: '14px',
                                                                transition: 'all 0.3s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.target.style.background = '#764ba2';
                                                                e.target.style.transform = 'translateY(-2px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.style.background = '#667eea';
                                                                e.target.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <i className="fas fa-external-link-alt"></i>
                                                            Open in OpenStreetMap
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Contact Information */}
                                    <div className="detail-section">
                                        <h4>
                                            <i className="fas fa-phone"></i>
                                            Contact Information
                                        </h4>
                                        <div className="detail-info">
                                            {selectedBusinessDetail.phone && (
                                                <p><strong>Phone:</strong> {selectedBusinessDetail.phone}</p>
                                            )}
                                            {selectedBusinessDetail.email && (
                                                <p><strong>Email:</strong> {selectedBusinessDetail.email}</p>
                                            )}
                                            {selectedBusinessDetail.website && (
                                                <p>
                                                    <strong>Website:</strong>{' '}
                                                    <a href={selectedBusinessDetail.website} target="_blank" rel="noopener noreferrer">
                                                        {selectedBusinessDetail.website}
                                                    </a>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {selectedBusinessDetail.description && (
                                        <div className="detail-section">
                                            <h4>
                                                <i className="fas fa-info-circle"></i>
                                                About
                                            </h4>
                                            <p className="business-description-full">{selectedBusinessDetail.description}</p>
                                        </div>
                                    )}

                                    {/* Reviews */}
                                    {selectedBusinessDetail.reviews && selectedBusinessDetail.reviews.length > 0 ? (
                                        <div className="detail-section">
                                            <h4>
                                                <i className="fas fa-star"></i>
                                                Reviews ({selectedBusinessDetail.reviews.length})
                                            </h4>
                                            <div className="reviews-list">
                                                {selectedBusinessDetail.reviews.map((review) => (
                                                    <div key={review.id} className="review-item">
                                                        <div className="review-header">
                                                            <div className="review-user">
                                                                {review.user?.avatar ? (
                                                                    <img src={review.user.avatar} alt={review.user.name} className="review-avatar" />
                                                                ) : (
                                                                    <div className="review-avatar-placeholder">
                                                                        <i className="fas fa-user"></i>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <strong>{review.user?.name || 'Anonymous'}</strong>
                                                                    <div className="review-rating">
                                                                        {'★'.repeat(review.rating)}
                                                                        {'☆'.repeat(5 - review.rating)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="review-date">{formatDate(review.createdAt)}</span>
                                                        </div>
                                                        {review.title && (
                                                            <h5 className="review-title">{review.title}</h5>
                                                        )}
                                                        <p className="review-comment">{review.comment}</p>
                                                        {review.images && review.images.length > 0 && (
                                                            <div className="review-images">
                                                                {review.images.map((img, idx) => (
                                                                    <img key={idx} src={img} alt={`Review ${idx + 1}`} className="review-image" />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="detail-section">
                                            <h4>
                                                <i className="fas fa-star"></i>
                                                Reviews
                                            </h4>
                                            <p className="no-reviews">No reviews yet. Be the first to review this business!</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="modal-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <p>Failed to load business details</p>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeBusinessModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceRequest;
