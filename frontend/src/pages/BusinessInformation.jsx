import React, { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './BusinessInformation.css';

const BusinessInformation = () => {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const businessIdParam = searchParams.get('businessId');
  
  const [business, setBusiness] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const messageRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA',
    categoryId: '',
    subCategoryId: '',
    hours: {},
    socialMedia: [],
    tags: [],
    isPublic: true,
    logo: '',
    latitude: null,
    longitude: null
  });
  const [categoriesWithServices, setCategoriesWithServices] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of { type: 'category' | 'service', id, name, categoryId? }
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [newSocialPlatform, setNewSocialPlatform] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [newTag, setNewTag] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const dropdownRef = useRef(null);
  const categoriesServicesInputRef = useRef(null);

  const socialPlatforms = [
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'pinterest', label: 'Pinterest' }
  ];

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchData();
  }, [businessIdParam]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll error into view when it appears
  useEffect(() => {
    if (message.text && messageRef.current) {
      messageRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [message.text]);

  const fetchData = async () => {
    try {
      // Fetch all user businesses first
      const businessRes = await api.get('/businesses/my-businesses');
      const allBusinesses = businessRes.data.businesses || [];
      setBusinesses(allBusinesses);
      
      let selectedBusiness = null;
      
      // If businessIdParam is provided, fetch that specific business
      if (businessIdParam) {
        try {
          const singleBusinessRes = await api.get(`/businesses/${businessIdParam}`);
          selectedBusiness = singleBusinessRes.data.business;
        } catch (error) {
          // If not found, try to find in the list
          selectedBusiness = allBusinesses.find(b => b.id === parseInt(businessIdParam));
        }
      }
      
      // If no business found yet, get first from list
      if (!selectedBusiness && allBusinesses.length > 0) {
        selectedBusiness = allBusinesses[0];
      }

      const categoriesRes = await api.get('/categories');
      const categories = categoriesRes.data.categories || [];
      
      // Fetch subcategories for all categories
      const categoriesWithSubs = await Promise.all(
        categories.map(async (category) => {
          try {
            const subRes = await api.get(`/subcategories?categoryId=${category.id}`);
            return {
              ...category,
              subcategories: subRes.data.subcategories || []
            };
          } catch (error) {
            return {
              ...category,
              subcategories: []
            };
          }
        })
      );

      setCategoriesWithServices(categoriesWithSubs);

      if (selectedBusiness) {
        setBusiness(selectedBusiness);
        
        // Initialize selected items from business data (only services, not categories)
        const selected = [];
        
        // Add services if exists - handle both array and JSON string
        let bizServices = selectedBusiness.services || [];
        if (typeof bizServices === 'string') {
          try {
            bizServices = JSON.parse(bizServices);
          } catch (e) {
            console.error('Error parsing services JSON:', e);
            bizServices = [];
          }
        }
        if (Array.isArray(bizServices) && bizServices.length > 0) {
          bizServices.forEach(serviceName => {
            // Find which category this service belongs to
            for (const cat of categoriesWithSubs) {
              const service = cat.subcategories.find(sub => sub.name === serviceName);
              if (service) {
                selected.push({
                  type: 'service',
                  id: service.id,
                  name: service.name,
                  categoryId: cat.id,
                  categoryName: cat.name
                });
                break;
              }
            }
          });
        }
        
        setSelectedItems(selected);
        
        setFormData({
          name: selectedBusiness.name || '',
          description: selectedBusiness.description || '',
          phone: selectedBusiness.phone || '',
          email: selectedBusiness.email || '',
          website: selectedBusiness.website || '',
          address: selectedBusiness.address || '',
          city: selectedBusiness.city || '',
          state: selectedBusiness.state || '',
          zipCode: selectedBusiness.zipCode || '',
          country: selectedBusiness.country || 'USA',
          categoryId: selectedBusiness.categoryId || '',
          subCategoryId: selectedBusiness.subCategoryId || '',
          hours: selectedBusiness.hours || {},
          socialMedia: selectedBusiness.socialLinks && typeof selectedBusiness.socialLinks === 'object' 
            ? Object.entries(selectedBusiness.socialLinks).map(([platform, url]) => ({ platform, url }))
            : [],
          tags: Array.isArray(selectedBusiness.tags) ? selectedBusiness.tags : [],
          isPublic: selectedBusiness.isPublic !== undefined ? selectedBusiness.isPublic : true,
          logo: selectedBusiness.logo || ''
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessChange = async (businessId) => {
    if (!businessId) return;
    
    try {
      setLoading(true);
      const businessRes = await api.get(`/businesses/${businessId}`);
      const selectedBusiness = businessRes.data.business;
      
      setBusiness(selectedBusiness);
      
      // Initialize selected items from business data (only services, not categories)
      const selected = [];
      
      // Add services if exists - handle both array and JSON string
      let bizServices = selectedBusiness.services || [];
      if (typeof bizServices === 'string') {
        try {
          bizServices = JSON.parse(bizServices);
        } catch (e) {
          console.error('Error parsing services JSON:', e);
          bizServices = [];
        }
      }
      if (Array.isArray(bizServices) && bizServices.length > 0 && categoriesWithServices.length > 0) {
        bizServices.forEach(serviceName => {
          // Find which category this service belongs to
          for (const cat of categoriesWithServices) {
            const service = cat.subcategories.find(sub => sub.name === serviceName);
            if (service) {
              selected.push({
                type: 'service',
                id: service.id,
                name: service.name,
                categoryId: cat.id,
                categoryName: cat.name
              });
              break;
            }
          }
        });
      }
      
      setSelectedItems(selected);
      
      setFormData({
        name: selectedBusiness.name || '',
        description: selectedBusiness.description || '',
        phone: selectedBusiness.phone || '',
        email: selectedBusiness.email || '',
        website: selectedBusiness.website || '',
        address: selectedBusiness.address || '',
        city: selectedBusiness.city || '',
        state: selectedBusiness.state || '',
        zipCode: selectedBusiness.zipCode || '',
        country: selectedBusiness.country || 'USA',
        categoryId: selectedBusiness.categoryId || '',
        subCategoryId: selectedBusiness.subCategoryId || '',
        hours: selectedBusiness.hours || {},
        socialMedia: selectedBusiness.socialLinks && typeof selectedBusiness.socialLinks === 'object' 
          ? Object.entries(selectedBusiness.socialLinks).map(([platform, url]) => ({ platform, url }))
          : [],
        tags: Array.isArray(selectedBusiness.tags) ? selectedBusiness.tags : [],
        isPublic: selectedBusiness.isPublic !== undefined ? selectedBusiness.isPublic : true,
        logo: selectedBusiness.logo || '',
        latitude: selectedBusiness.latitude || null,
        longitude: selectedBusiness.longitude || null
      });
    } catch (error) {
      console.error('Error fetching business:', error);
      setMessage({ type: 'error', text: 'Failed to load business data' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Auto-geocode zip code when it changes
  useEffect(() => {
    const geocodeZipCode = async () => {
      const zipCode = formData.zipCode?.trim();
      
      // Only geocode if zip code is valid (5 digits or more)
      if (zipCode && zipCode.length >= 5 && formData.country === 'USA') {
        try {
          const cleanZipCode = zipCode.replace(/[\s\-]/g, '').substring(0, 5);
          const response = await api.get(`/businesses/geocode/${cleanZipCode}`);
          
          if (response.data.success && response.data.coordinates) {
            setFormData(prev => ({
              ...prev,
              latitude: response.data.coordinates.latitude,
              longitude: response.data.coordinates.longitude
            }));
          }
        } catch (error) {
          // Silently fail - coordinates are optional
          console.log('Could not geocode zip code:', error);
        }
      } else if (!zipCode || formData.country !== 'USA') {
        // Clear coordinates if zip code is removed or country is not USA
        setFormData(prev => ({
          ...prev,
          latitude: null,
          longitude: null
        }));
      }
    };

    // Debounce geocoding to avoid too many API calls
    const timeoutId = setTimeout(() => {
      geocodeZipCode();
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.zipCode, formData.country]);

  // Build grouped list of categories with their services for display
  const getGroupedItems = () => {
    return categoriesWithServices.map(category => ({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description
      },
      services: category.subcategories.map(service => ({
        type: 'service',
        id: service.id,
        name: service.name,
        description: service.description,
        categoryId: category.id,
        categoryName: category.name
      }))
    }));
  };

  // Build flat list of all selectable items (only services, not categories)
  const getAllSelectableItems = () => {
    const items = [];
    categoriesWithServices.forEach(category => {
      // Only add services under this category (no categories as selectable items)
      category.subcategories.forEach(service => {
        items.push({
          type: 'service',
          id: service.id,
          name: service.name,
          description: service.description,
          categoryId: category.id,
          categoryName: category.name
        });
      });
    });
    return items;
  };

  // Get filtered and grouped items for display
  const getFilteredGroupedItems = () => {
    const grouped = getGroupedItems();
    const searchLower = searchQuery.toLowerCase();
    
    return grouped.map(group => {
      // Filter services in this group
      const filteredServices = group.services.filter(service => {
        const matchesSearch = !searchQuery || 
          service.name.toLowerCase().includes(searchLower) ||
          (service.description && service.description.toLowerCase().includes(searchLower));
        
        const isSelected = selectedItems.some(selected => 
          selected.type === service.type && selected.id === service.id
        );
        
        return matchesSearch && !isSelected;
      });
      
      // Only include category if it has matching services or search matches category name
      const categoryMatches = !searchQuery || 
        group.category.name.toLowerCase().includes(searchLower);
      
      if (filteredServices.length > 0 || categoryMatches) {
        return {
          ...group,
          services: filteredServices
        };
      }
      return null;
    }).filter(group => group !== null && group.services.length > 0);
  };

  const filteredItems = getAllSelectableItems().filter(item => {
    // Filter by search query
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter out already selected items
    const isSelected = selectedItems.some(selected => 
      selected.type === item.type && selected.id === item.id
    );
    
    return matchesSearch && !isSelected;
  });

  const handleItemSelect = (item) => {
     if (selectedItems.length >= 20) {
       setMessage({ type: 'error', text: 'Maximum 20 services allowed' });
       return;
     }
    
    // Check for duplicates
    const isDuplicate = selectedItems.some(selected => 
      selected.type === item.type && selected.id === item.id
    );

    if (!isDuplicate) {
      setSelectedItems([...selectedItems, item]);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleRemoveItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen && e.key === 'Enter') {
      setIsDropdownOpen(true);
      return;
    }

    if (!isDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleItemSelect(filteredItems[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const getItemDisplayName = (item) => {
    return item.name;
  };

  const handleHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          [field]: value,
          enabled: prev.hours[day]?.enabled !== false
        }
      }
    }));
  };

  const toggleDayEnabled = (day) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          enabled: !prev.hours[day]?.enabled
        }
      }
    }));
  };

  const addSocialMedia = () => {
    if (newSocialPlatform && newSocialUrl) {
      setFormData(prev => ({
        ...prev,
        socialMedia: [...prev.socialMedia, { platform: newSocialPlatform, url: newSocialUrl }]
      }));
      setNewSocialPlatform('');
      setNewSocialUrl('');
    }
  };

  const removeSocialMedia = (index) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: prev.socialMedia.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (newTag.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
      return;
    }

    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Update formData with the new logo
        setFormData(prev => ({ ...prev, logo: reader.result }));
        setMessage({ type: 'success', text: 'Logo uploaded successfully! It will be saved when you click "Save Changes".' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to process logo' });
      } finally {
        setUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logo: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      // Convert socialMedia array to object format (socialLinks)
      const socialLinks = {};
      formData.socialMedia.forEach(social => {
        if (social.platform && social.url) {
          socialLinks[social.platform] = social.url;
        }
      });

      // Get services (categories are not selectable)
      const selectedServices = selectedItems.filter(item => item.type === 'service');
      
      // Get primary category from first service's category or existing business category
      const primaryCategoryId = selectedServices.length > 0 
        ? selectedServices[0].categoryId 
        : (business.categoryId || null);
      
      // Convert services to array of strings for backend
      const servicesToSave = selectedServices.map(item => item.name);

      // Prepare submit data - only send fields that exist in the model
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim().toUpperCase(),
        country: formData.country || 'USA'
      };

      // Add category if available
      if (primaryCategoryId) {
        submitData.categoryId = parseInt(primaryCategoryId);
      }

      // Add services (always include, even if empty array to clear existing)
      submitData.services = servicesToSave;

      // Add optional fields only if they have values
      if (formData.website && formData.website.trim()) {
        submitData.website = formData.website.trim();
      }
      if (formData.zipCode && formData.zipCode.trim()) {
        submitData.zipCode = formData.zipCode.trim();
      }
      if (formData.subCategoryId) {
        submitData.subCategoryId = parseInt(formData.subCategoryId);
      }
      if (formData.hours && Object.keys(formData.hours).length > 0) {
        submitData.hours = formData.hours;
      }
      if (Object.keys(socialLinks).length > 0) {
        submitData.socialLinks = socialLinks;
      }
      if (Array.isArray(formData.tags) && formData.tags.length > 0) {
        submitData.tags = formData.tags;
      }
      if (formData.isPublic !== undefined) {
        submitData.isPublic = formData.isPublic;
      }
      if (formData.logo) {
        submitData.logo = formData.logo;
      }

      await api.put(`/businesses/${business.id}`, submitData);
      
      // Refresh business data to get updated services
      const businessRes = await api.get(`/businesses/${business.id}`);
      const updatedBusiness = businessRes.data.business;
      setBusiness(updatedBusiness);
      
      // Re-initialize selected items from updated business data (only services)
      const selected = [];
      
      // Add services if exists - handle both array and JSON string
      let bizServices = updatedBusiness.services || [];
      if (typeof bizServices === 'string') {
        try {
          bizServices = JSON.parse(bizServices);
        } catch (e) {
          console.error('Error parsing services JSON:', e);
          bizServices = [];
        }
      }
      if (Array.isArray(bizServices) && bizServices.length > 0 && categoriesWithServices.length > 0) {
        bizServices.forEach(serviceName => {
          // Find which category this service belongs to
          for (const cat of categoriesWithServices) {
            const service = cat.subcategories.find(sub => sub.name === serviceName);
            if (service) {
              selected.push({
                type: 'service',
                id: service.id,
                name: service.name,
                categoryId: cat.id,
                categoryName: cat.name
              });
              break;
            }
          }
        });
      }
      
      setSelectedItems(selected);
      
      setMessage({ type: 'success', text: 'Business information updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update business information';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="business-information-page"><div className="loading">Loading...</div></div>;
  }

  if (!business) {
    return <div className="business-information-page"><div className="empty">No business found</div></div>;
  }

  return (
    <div className="business-information-page">
      <div className="page-header-section">
        <h1 className="page-title">Business Information</h1>
        {businesses.length > 1 && (
          <div className="business-selector">
            <label htmlFor="business-select">Select Business:</label>
            <select
              id="business-select"
              value={business?.id || ''}
              onChange={(e) => handleBusinessChange(e.target.value)}
              className="business-select-dropdown"
            >
              {businesses.map(biz => (
                <option key={biz.id} value={biz.id}>
                  {biz.name} {!biz.isActive ? '(Pending)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {message.text && (
        <div ref={messageRef} className={`alert alert-${message.type} alert-visible`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="business-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3 className="section-title">Basic Information</h3>
          
          {/* Logo Upload */}
          <div className="form-field full-width">
            <label>Business Logo</label>
            <div className="logo-upload-area">
              {formData.logo ? (
                <div className="logo-preview">
                  <img src={formData.logo} alt="Business Logo" />
                  <button 
                    type="button" 
                    className="remove-logo-btn"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ) : (
                <label className="upload-placeholder">
                  {uploadingLogo ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt"></i>
                      <span>Click to upload logo</span>
                      <small>Max 2MB, JPG/PNG</small>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                    disabled={uploadingLogo}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Business Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter business name"
              />
            </div>
            <div className="form-field full-width">
              <label>Categories & Services *</label>
               <p style={{ fontSize: '12px', color: '#7f8c8d', margin: '0 0 12px 0' }}>
                 Search and select services your business offers
               </p>

               {/* Selected Services Tags */}
               {selectedItems.length > 0 && (
                 <div className="selected-services-tags" style={{ marginBottom: '12px' }}>
                   {selectedItems.map((item, index) => (
                     <div key={`${item.type}-${item.id}`} className="service-tag tag-service">
                       <i className="fas fa-tag"></i>
                       <span>{getItemDisplayName(item)}</span>
                       {item.categoryName && (
                         <span className="tag-category-badge">{item.categoryName}</span>
                       )}
                       <button
                         type="button"
                         onClick={() => handleRemoveItem(index)}
                         className="tag-remove-btn"
                         title="Remove"
                       >
                         <i className="fas fa-times"></i>
                       </button>
                     </div>
                   ))}
                 </div>
               )}

              {/* Multi-Select Dropdown */}
              <div className="multi-select-container" ref={dropdownRef}>
                <div className="multi-select-input-wrapper">
                  <input
                    ref={categoriesServicesInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      setHighlightedIndex(-1);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleKeyDown}
                     placeholder={selectedItems.length >= 20 ? "Maximum 20 services reached" : "Search services..."}
                    className="multi-select-input"
                    disabled={selectedItems.length >= 20}
                  />
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="dropdown-toggle"
                    disabled={selectedItems.length >= 20}
                  >
                    <i className={`fas fa-chevron-${isDropdownOpen ? 'up' : 'down'}`}></i>
                  </button>
                </div>

                 {isDropdownOpen && getFilteredGroupedItems().length > 0 && (
                   <div className="multi-select-dropdown">
                     {getFilteredGroupedItems().map((group, groupIndex) => {
                       let serviceIndex = 0;
                       // Calculate starting index for services in this group
                       const startIndex = getFilteredGroupedItems()
                         .slice(0, groupIndex)
                         .reduce((sum, g) => sum + g.services.length, 0);
                       
                       return (
                         <div key={`category-${group.category.id}`} className="dropdown-group">
                           {/* Category Header - Non-selectable */}
                           <div className="dropdown-category-header">
                             {group.category.icon && <i className={`fas fa-${group.category.icon}`}></i>}
                             <span className="category-header-name">{group.category.name}</span>
                           </div>
                           
                           {/* Services under this category */}
                           {group.services.map((service) => {
                             const currentIndex = startIndex + serviceIndex++;
                             return (
                               <div
                                 key={`service-${service.id}`}
                                 className={`dropdown-option ${currentIndex === highlightedIndex ? 'highlighted' : ''} option-service`}
                                 onClick={() => handleItemSelect(service)}
                                 onMouseEnter={() => setHighlightedIndex(currentIndex)}
                               >
                                 <div className="option-header">
                                   <i className="fas fa-tag"></i>
                                   <span className="option-name">{service.name}</span>
                                 </div>
                                 {service.description && (
                                   <span className="option-description">{service.description}</span>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       );
                     })}
                   </div>
                 )}

                 {isDropdownOpen && searchQuery && getFilteredGroupedItems().length === 0 && (
                   <div className="multi-select-dropdown">
                     <div className="dropdown-empty">
                       <i className="fas fa-search"></i>
                       <p>No services found matching "{searchQuery}"</p>
                     </div>
                   </div>
                 )}

                 {isDropdownOpen && !searchQuery && getFilteredGroupedItems().length === 0 && getAllSelectableItems().length > 0 && (
                   <div className="multi-select-dropdown">
                     <div className="dropdown-empty">
                       <i className="fas fa-check-circle"></i>
                       <p>All available services have been selected</p>
                     </div>
                   </div>
                 )}

                 {isDropdownOpen && getAllSelectableItems().length === 0 && (
                   <div className="multi-select-dropdown">
                     <div className="dropdown-empty">
                       <i className="fas fa-info-circle"></i>
                       <p>No services available</p>
                     </div>
                   </div>
                 )}
              </div>
            </div>
            <div className="form-field full-width">
              <label>Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="5"
                placeholder="Describe your business"
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="form-section">
          <h3 className="section-title">Contact Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="form-field">
              <label>Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="business@example.com"
              />
            </div>
            <div className="form-field">
              <label>Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="form-section">
          <h3 className="section-title">Address Information</h3>
          <div className="form-grid">
            <div className="form-field full-width">
              <label>Street Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="123 Main Street"
              />
            </div>
            <div className="form-field">
              <label>City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                placeholder="City"
              />
            </div>
            <div className="form-field">
              <label>State *</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                placeholder="State"
                maxLength="2"
              />
            </div>
            <div className="form-field">
              <label>Zip Code</label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="12345"
              />
            </div>
            <div className="form-field">
              <label>Country *</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                required
              >
                <option value="USA">United States</option>
                <option value="Canada">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="form-section">
          <h3 className="section-title">Social Media Links</h3>
          <div className="social-media-section">
            {formData.socialMedia.map((social, index) => (
              <div key={index} className="social-media-item">
                <div className="social-platform-badge">
                  {socialPlatforms.find(p => p.value === social.platform)?.label || social.platform}
                </div>
                <input
                  type="url"
                  value={social.url}
                  onChange={(e) => {
                    const updated = [...formData.socialMedia];
                    updated[index].url = e.target.value;
                    setFormData(prev => ({ ...prev, socialMedia: updated }));
                  }}
                  placeholder="https://..."
                  className="social-url-input"
                />
                <button
                  type="button"
                  className="remove-social-btn"
                  onClick={() => removeSocialMedia(index)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            <div className="add-social-media">
              <select
                value={newSocialPlatform}
                onChange={(e) => setNewSocialPlatform(e.target.value)}
                className="social-platform-select"
              >
                <option value="">Select Platform</option>
                {socialPlatforms.map(platform => (
                  <option key={platform.value} value={platform.value}>
                    {platform.label}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={newSocialUrl}
                onChange={(e) => setNewSocialUrl(e.target.value)}
                placeholder="Enter URL"
                className="social-url-input"
              />
              <button
                type="button"
                className="add-social-btn"
                onClick={addSocialMedia}
                disabled={!newSocialPlatform || !newSocialUrl}
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="form-section">
          <h3 className="section-title">Working Hours</h3>
          <div className="hours-section">
            {daysOfWeek.map(day => (
              <div key={day} className="hours-row">
                <div className="day-toggle">
                  <input
                    type="checkbox"
                    checked={formData.hours[day]?.enabled !== false}
                    onChange={() => toggleDayEnabled(day)}
                    id={`day-${day}`}
                  />
                  <label htmlFor={`day-${day}`} className="day-label">{day}</label>
                </div>
                {formData.hours[day]?.enabled !== false && (
                  <div className="hours-inputs">
                    <input
                      type="time"
                      value={formData.hours[day]?.open || ''}
                      onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                      className="time-input"
                    />
                    <span className="time-separator">to</span>
                    <input
                      type="time"
                      value={formData.hours[day]?.close || ''}
                      onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                      className="time-input"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="form-section">
          <h3 className="section-title">Tags</h3>
          <div className="tags-section">
            {formData.tags.length > 0 && (
              <div className="tags-list">
                {formData.tags.map((tag, index) => (
                  <div key={index} className="tag-item">
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => removeTag(index)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-tag">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Enter tag and press Enter"
                className="tag-input"
              />
              <button
                type="button"
                className="add-tag-btn"
                onClick={addTag}
                disabled={!newTag.trim()}
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Visibility Settings */}
        <div className="form-section">
          <h3 className="section-title">Visibility Settings</h3>
          <div className="form-field full-width">
            <label className="checkbox-option" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8f9fa', border: '1px solid #e1e8ed', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', color: '#2c3e50' }}>
                Display this business profile on the main site
              </span>
            </label>
            <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px', marginLeft: '30px' }}>
              When enabled, your business will be visible to all visitors on the main site. When disabled, only you can see it in your dashboard.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BusinessInformation;
