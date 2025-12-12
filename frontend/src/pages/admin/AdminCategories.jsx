import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

// Popular FontAwesome icons for categories
const POPULAR_ICONS = [
  'briefcase', 'utensils', 'home', 'heart', 'star', 'shopping-bag', 'car', 'plane',
  'bed', 'dumbbell', 'music', 'film', 'book', 'graduation-cap', 'stethoscope', 'wrench',
  'paint-brush', 'cut', 'coffee', 'pizza-slice', 'hamburger', 'ice-cream', 'bicycle',
  'ship', 'train', 'bus', 'taxi', 'motorcycle', 'truck', 'building', 'store',
  'shopping-cart', 'gift', 'camera', 'laptop', 'mobile-alt', 'headphones', 'gamepad',
  'football-ball', 'basketball-ball', 'swimming-pool', 'spa', 'baby', 'child', 'dog',
  'cat', 'paw', 'tree', 'leaf', 'sun', 'moon', 'umbrella', 'tshirt', 'gem', 'ring',
  'watch', 'glasses', 'key', 'lock', 'unlock', 'shield-alt', 'fire', 'lightbulb',
  'wifi', 'battery-full', 'plug', 'tools', 'hammer', 'screwdriver', 'pencil-alt',
  'pen', 'eraser', 'ruler', 'calculator', 'chart-line', 'chart-bar', 'wallet',
  'credit-card', 'money-bill', 'coins', 'hand-holding-usd', 'piggy-bank', 'envelope',
  'phone', 'fax', 'print', 'copy', 'file', 'folder', 'folder-open', 'archive',
  'database', 'server', 'cloud', 'network-wired', 'satellite', 'rocket', 'flask',
  'microscope', 'atom', 'dna', 'virus', 'syringe', 'pills', 'band-aid', 'heartbeat',
  'ambulance', 'hospital', 'clinic-medical', 'user-md', 'user-nurse', 'procedures',
  'x-ray', 'crutch', 'wheelchair', 'eye', 'ear', 'tooth', 'lungs', 'brain'
];

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [activeTab, setActiveTab] = useState('categories');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconPickerFor, setIconPickerFor] = useState(null); // 'category' or 'subcategory'
  const [iconSearch, setIconSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    description: '',
    isActive: true,
    order: 0
  });

  const [subFormData, setSubFormData] = useState({
    name: '',
    icon: 'folder',
    description: '',
    categoryId: '',
    isActive: true,
    order: 0
  });

  useEffect(() => {
    loadCategories();
    loadSubcategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/categories');
      setCategories(response.data.categories);
    } catch (error) {
      alert('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadSubcategories = async () => {
    try {
      const response = await api.get('/admin/subcategories');
      setSubcategories(response.data.subcategories || []);
    } catch (error) {
      console.error('Failed to load subcategories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingCategory) {
        await api.put(`/admin/categories/${editingCategory.id}`, formData);
        alert('Category updated successfully!');
      } else {
        await api.post('/admin/categories', formData);
        alert('Category created successfully!');
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', icon: '', description: '', isActive: true, order: 0 });
      loadCategories();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save category');
    }
  };

  const handleSubSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingSubcategory) {
        await api.put(`/admin/subcategories/${editingSubcategory.id}`, subFormData);
        alert('Subcategory updated successfully!');
      } else {
        await api.post('/admin/subcategories', subFormData);
        alert('Subcategory created successfully!');
      }
      setShowSubModal(false);
      setEditingSubcategory(null);
      setSubFormData({ name: '', icon: 'folder', description: '', categoryId: '', isActive: true, order: 0 });
      loadSubcategories();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save subcategory');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon,
      description: category.description || '',
      isActive: category.isActive,
      order: category.order || 0
    });
    setShowModal(true);
  };

  const handleEditSub = (sub) => {
    setEditingSubcategory(sub);
    setSubFormData({
      name: sub.name,
      icon: sub.icon || 'folder',
      description: sub.description || '',
      categoryId: sub.categoryId,
      isActive: sub.isActive,
      order: sub.order || 0
    });
    setShowSubModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await api.delete(`/admin/categories/${id}`);
      alert('Category deleted successfully!');
      loadCategories();
    } catch (error) {
      alert('Failed to delete category');
    }
  };

  const handleDeleteSub = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subcategory?')) return;
    
    try {
      await api.delete(`/admin/subcategories/${id}`);
      alert('Subcategory deleted successfully!');
      loadSubcategories();
    } catch (error) {
      alert('Failed to delete subcategory');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Categories & Subcategories Management</h2>
        <div className="header-actions">
          {activeTab === 'categories' ? (
            <button 
              className="btn-primary-action"
              onClick={() => {
                setEditingCategory(null);
                setFormData({ name: '', icon: '', description: '', isActive: true, order: 0 });
                setShowModal(true);
              }}
            >
              <i className="fas fa-plus"></i> Add Category
            </button>
          ) : (
            <button 
              className="btn-primary-action"
              onClick={() => {
                setEditingSubcategory(null);
                setSubFormData({ name: '', icon: 'folder', description: '', categoryId: '', isActive: true, order: 0 });
                setShowSubModal(true);
              }}
            >
              <i className="fas fa-plus"></i> Add Subcategory
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <i className="fas fa-tags"></i> Categories ({categories.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'subcategories' ? 'active' : ''}`}
          onClick={() => setActiveTab('subcategories')}
        >
          <i className="fas fa-folder"></i> Subcategories ({subcategories.length})
        </button>
      </div>

      {activeTab === 'categories' ? (
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Icon</th>
                <th>Name</th>
                <th>Description</th>
                <th>Subcategories</th>
                <th>Businesses</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.id}</td>
                    <td>
                      <i className={`fas fa-${category.icon || 'briefcase'}`} style={{fontSize: '20px'}}></i>
                    </td>
                    <td><strong>{category.name}</strong></td>
                    <td>{category.description}</td>
                    <td>
                      <span className="count-badge">
                        {subcategories.filter(s => s.categoryId === category.id).length}
                      </span>
                    </td>
                    <td>{category.businessCount || 0}</td>
                    <td>{category.order}</td>
                    <td>
                      <span className={`status-badge ${category.isActive ? 'active' : 'inactive'}`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-edit"
                          onClick={() => handleEdit(category)}
                          title="Edit Category"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDelete(category.id)}
                          title="Delete Category"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="empty-state">No categories found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Icon</th>
                <th>Name</th>
                <th>Parent Category</th>
                <th>Description</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subcategories.length > 0 ? (
                subcategories.map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.id}</td>
                    <td>
                      <i className={`fas fa-${sub.icon || 'folder'}`} style={{fontSize: '18px'}}></i>
                    </td>
                    <td><strong>{sub.name}</strong></td>
                    <td>
                      <span className="parent-badge">
                        <i className={`fas fa-${sub.category?.icon || 'tag'}`}></i>
                        {sub.category?.name || 'N/A'}
                      </span>
                    </td>
                    <td>{sub.description || '-'}</td>
                    <td>{sub.order}</td>
                    <td>
                      <span className={`status-badge ${sub.isActive ? 'active' : 'inactive'}`}>
                        {sub.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-edit"
                          onClick={() => handleEditSub(sub)}
                          title="Edit Subcategory"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteSub(sub.id)}
                          title="Delete Subcategory"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-state">No subcategories found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Category Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Icon (FontAwesome name) *</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    placeholder="e.g., utensils, briefcase, heart"
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIconPickerFor('category');
                      setShowIconPicker(true);
                      setIconSearch('');
                    }}
                    className="icon-picker-btn"
                    title="Browse Icons"
                  >
                    <i className="fas fa-th"></i> Browse
                  </button>
                </div>
                {formData.icon && (
                  <div className="icon-preview">
                    <i className={`fas fa-${formData.icon}`}></i>
                    <span>Preview: {formData.icon}</span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Order</label>
                <input 
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({...formData, order: parseInt(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>
                  <input 
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  {' '}Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {showSubModal && (
        <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}</h3>
            <form onSubmit={handleSubSubmit}>
              <div className="form-group">
                <label>Parent Category *</label>
                <select 
                  value={subFormData.categoryId}
                  onChange={(e) => setSubFormData({...subFormData, categoryId: e.target.value})}
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {subFormData.categoryId && (() => {
                  const selectedCategory = categories.find(cat => cat.id === parseInt(subFormData.categoryId));
                  return selectedCategory ? (
                    <div className="icon-preview" style={{ marginTop: '10px' }}>
                      <i className={`fas fa-${selectedCategory.icon || 'briefcase'}`} style={{ fontSize: '24px', marginRight: '8px' }}></i>
                      <span>Selected Category Icon: <strong>{selectedCategory.name}</strong></span>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="form-group">
                <label>Name *</label>
                <input 
                  type="text"
                  value={subFormData.name}
                  onChange={(e) => setSubFormData({...subFormData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Icon (FontAwesome name)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text"
                    value={subFormData.icon}
                    onChange={(e) => setSubFormData({...subFormData, icon: e.target.value})}
                    placeholder="e.g., folder, tag, star"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIconPickerFor('subcategory');
                      setShowIconPicker(true);
                      setIconSearch('');
                    }}
                    className="icon-picker-btn"
                    title="Browse Icons"
                  >
                    <i className="fas fa-th"></i> Browse
                  </button>
                </div>
                {subFormData.icon && (
                  <div className="icon-preview">
                    <i className={`fas fa-${subFormData.icon}`}></i>
                    <span>Preview: {subFormData.icon}</span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={subFormData.description}
                  onChange={(e) => setSubFormData({...subFormData, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Order</label>
                <input 
                  type="number"
                  value={subFormData.order}
                  onChange={(e) => setSubFormData({...subFormData, order: parseInt(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>
                  <input 
                    type="checkbox"
                    checked={subFormData.isActive}
                    onChange={(e) => setSubFormData({...subFormData, isActive: e.target.checked})}
                  />
                  {' '}Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowSubModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingSubcategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <div className="modal-overlay" onClick={() => setShowIconPicker(false)}>
          <div className="modal icon-picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select an Icon</h3>
            <div className="icon-picker-search">
              <input
                type="text"
                placeholder="Search icons..."
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="icon-picker-grid">
              {POPULAR_ICONS
                .filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase()))
                .map((icon) => (
                  <div
                    key={icon}
                    className="icon-picker-item"
                    onClick={() => {
                      if (iconPickerFor === 'category') {
                        setFormData({...formData, icon});
                      } else {
                        setSubFormData({...subFormData, icon});
                      }
                      setShowIconPicker(false);
                    }}
                    title={icon}
                  >
                    <i className={`fas fa-${icon}`}></i>
                    <span>{icon}</span>
                  </div>
                ))}
            </div>
            {POPULAR_ICONS.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase())).length === 0 && (
              <div className="icon-picker-empty">
                <i className="fas fa-search"></i>
                <p>No icons found matching "{iconSearch}"</p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowIconPicker(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
