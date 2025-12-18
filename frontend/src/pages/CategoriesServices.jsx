import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './CategoriesServices.css';

const CategoriesServices = () => {
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [categoriesWithServices, setCategoriesWithServices] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of { type: 'service', id, name, categoryId? }
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState(new Set()); // For multi-select in left panel
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [businessRes, categoriesRes] = await Promise.all([
        api.get('/businesses/my-businesses'),
        api.get('/categories')
      ]);

      const businesses = businessRes.data.businesses || [];
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

      if (businesses.length > 0) {
        const biz = businesses[0];
        setBusiness(biz);

        // Initialize selected items from business data (only services, not categories)
        const selected = [];

        // Add services if exists - handle both array and JSON string
        let bizServices = biz.services || [];
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
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

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

  // Get filtered and grouped items for display (left panel - available services)
  const getFilteredGroupedItems = () => {
    const grouped = getGroupedItems();
    const searchLower = searchQuery.toLowerCase();

    return grouped.map(group => {
      // Filter services in this group (exclude already selected)
      const filteredServices = group.services.filter(service => {
        const matchesSearch = !searchQuery ||
          service.name.toLowerCase().includes(searchLower) ||
          (service.description && service.description.toLowerCase().includes(searchLower));

        const isAlreadySelected = selectedItems.some(selected => selected.id === service.id);

        return matchesSearch && !isAlreadySelected;
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

  // Handle service click - swap between panels
  const handleServiceClick = (service, isSelected) => {
    if (isSelected) {
      // Remove from selected (move to available)
      setSelectedItems(selectedItems.filter(item => item.id !== service.id));
    } else {
      // Add to selected (move from available)
      if (selectedItems.length >= 20) {
        setMessage({ type: 'error', text: 'Maximum 20 services allowed' });
        return;
      }

      // Check for duplicates
      const isDuplicate = selectedItems.some(selected => selected.id === service.id);
      if (!isDuplicate) {
        setSelectedItems([...selectedItems, service]);
      }
    }
    // Clear multi-select when swapping
    setSelectedServiceIds(new Set());
  };

  // Handle multi-select toggle (for bulk operations)
  const handleToggleServiceSelection = (serviceId, e) => {
    if (e) e.stopPropagation();
    const newSelection = new Set(selectedServiceIds);
    if (newSelection.has(serviceId)) {
      newSelection.delete(serviceId);
    } else {
      newSelection.add(serviceId);
    }
    setSelectedServiceIds(newSelection);
  };

  // Handle bulk add (multiple selected services from left panel)
  const handleBulkAdd = () => {
    if (selectedServiceIds.size === 0) {
      setMessage({ type: 'error', text: 'Please select services to add' });
      return;
    }

    const servicesToAdd = getAllSelectableItems().filter(service =>
      selectedServiceIds.has(service.id) &&
      !selectedItems.some(selected => selected.id === service.id)
    );

    if (selectedItems.length + servicesToAdd.length > 20) {
      setMessage({ type: 'error', text: 'Maximum 20 services allowed' });
      return;
    }

    setSelectedItems([...selectedItems, ...servicesToAdd]);
    setSelectedServiceIds(new Set());
  };

  // Handle bulk remove (multiple selected services from right panel)
  const handleBulkRemove = () => {
    if (selectedServiceIds.size === 0) {
      setMessage({ type: 'error', text: 'Please select services to remove' });
      return;
    }

    setSelectedItems(selectedItems.filter(item => !selectedServiceIds.has(item.id)));
    setSelectedServiceIds(new Set());
  };

  const getItemDisplayName = (item) => {
    if (item.type === 'category') {
      return item.name;
    }
    return item.name;
  };

  const saveItems = async () => {
    if (!business) return;

    setSaving(true);
    try {
      // All selected items are services (categories are not selectable)
      const selectedServices = selectedItems;

      // Get primary category from first service's category or existing business category
      const primaryCategoryId = selectedServices.length > 0
        ? selectedServices[0].categoryId
        : (business?.categoryId || null);

      // Convert services to array of service names for backend
      const servicesToSave = selectedServices.map(item => item.name);

      const updateData = {};
      if (primaryCategoryId) {
        updateData.categoryId = primaryCategoryId;
      }
      if (servicesToSave.length > 0) {
        updateData.services = servicesToSave;
      } else {
        // If no services selected, set to empty array to clear existing services
        updateData.services = [];
      }

      await api.put(`/businesses/${business.id}`, updateData);

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
      if (Array.isArray(bizServices) && bizServices.length > 0) {
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

      setMessage({ type: 'success', text: 'Categories & Services updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving services:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update categories & services' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="categories-services-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="categories-services-page">
      <h1 className="page-title">Categories & Services</h1>

      {/* Informational Message */}
      <div className="info-banner">
        <i className="fas fa-info-circle"></i>
        <p>
          Let customers know what your business offers by selecting categories & services. This will help customers find your business, and help you generate leads.
        </p>
      </div>

      {/* Unified Categories & Services Selection */}
      <div className="section-card">
        <h3 className="section-title">Categories & Services</h3>
        <p className="section-description">
          Search and select services your business offers. You can select multiple services.
        </p>

        {message.text && (
          <div className={`alert alert-${message.type}`}>
            <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* Dual-List Interface */}
        <div className="dual-list-container">
          {/* Left Panel - Available Services */}
          <div className="services-panel available-panel">
            <div className="panel-header">
              <h4>Available Services</h4>
              <div className="panel-search">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services..."
                  className="panel-search-input"
                />
              </div>
              {selectedServiceIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkAdd}
                  className="panel-action-btn add-btn"
                  title="Add selected services"
                >
                  <i className="fas fa-arrow-right"></i> Add ({selectedServiceIds.size})
                </button>
              )}
            </div>
            <div className="panel-content">
              {getFilteredGroupedItems().length > 0 ? (
                <div className="services-list-grouped">
                  {getFilteredGroupedItems().map((group) => (
                    <div key={`category-${group.category.id}`} className="service-group">
                      {/* Category Header */}
                      <div className="group-category-header">
                        {group.category.icon && <i className={`fas fa-${group.category.icon}`}></i>}
                        <span>{group.category.name}</span>
                      </div>

                      {/* Services in this category */}
                      <div className="group-services">
                        {group.services.map((service) => {
                          const isSelected = selectedServiceIds.has(service.id);
                          const isAlreadySelected = selectedItems.some(item => item.id === service.id);

                          return (
                            <div
                              key={`service-${service.id}`}
                              className={`service-item ${isSelected ? 'selected' : ''} ${isAlreadySelected ? 'disabled' : ''}`}
                              onClick={(e) => {
                                if (!isAlreadySelected) {
                                  // Click to swap to selected panel
                                  handleServiceClick(service, false);
                                }
                              }}
                              title={isAlreadySelected ? 'Already selected' : 'Click to add to selected services'}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleToggleServiceSelection(service.id, e)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleServiceSelection(service.id, e);
                                }}
                                disabled={isAlreadySelected}
                                className="service-checkbox"
                                hidden
                              />
                              <div className="service-info">
                                <span className="service-name">{service.name}</span>
                                {service.description && (
                                  <span className="service-description">{service.description}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel-empty">
                  <i className="fas fa-info-circle"></i>
                  <p>
                    {searchQuery
                      ? `No services found matching "${searchQuery}"`
                      : selectedItems.length >= getAllSelectableItems().length
                        ? 'All services have been selected'
                        : 'No services available'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Selected Services */}
          <div className="services-panel selected-panel">
            <div className="panel-header">
              <h4>Selected Services ({selectedItems.length}/20)</h4>
              {selectedServiceIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkRemove}
                  className="panel-action-btn remove-btn"
                  title="Remove selected services"
                >
                  <i className="fas fa-arrow-left"></i> Remove ({selectedServiceIds.size})
                </button>
              )}
            </div>
            <div className="panel-content">
              {selectedItems.length > 0 ? (
                <div className="services-list">
                  {selectedItems.map((service) => {
                    const isSelected = selectedServiceIds.has(service.id);
                    return (
                      <div
                        key={`selected-${service.id}`}
                        className={`service-item selected-service ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          // Click to swap back to available panel
                          handleServiceClick(service, true);
                        }}
                        title="Click to remove from selected services"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleServiceSelection(service.id, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleServiceSelection(service.id, e);
                          }}
                          className="service-checkbox"
                          hidden
                        />
                        <div className="service-info">
                          <span className="service-name">{service.name}</span>
                          {service.categoryName && (
                            <span className="service-category">{service.categoryName}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceClick(service, true);
                          }}
                          className="service-remove-btn"
                          title="Remove service"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="panel-empty">
                  <i className="fas fa-inbox"></i>
                  <p>No services selected yet. Select services from the left panel to add them here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="save-section">
          <button
            onClick={saveItems}
            className="save-btn"
            disabled={saving || selectedItems.length === 0}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Save Services
              </>
            )}
          </button>
          <p className="save-note">Changes will be applied after clicking Save</p>
        </div>
      </div>
    </div>
  );
};

export default CategoriesServices;

