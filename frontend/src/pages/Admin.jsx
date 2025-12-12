import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Admin = () => {
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, businessesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/businesses')
      ]);
      setStats(statsRes.data.stats);
      setBusinesses(businessesRes.data.businesses || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const approveBusiness = async (id) => {
    try {
      await api.put(`/admin/businesses/${id}/approve`);
      loadData();
    } catch (error) {
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <h1>Admin Dashboard</h1>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div className="card">
            <h3>Users</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{stats.users}</p>
          </div>
          <div className="card">
            <h3>Businesses</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{stats.businesses}</p>
          </div>
          <div className="card">
            <h3>Pending</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--warning-color)' }}>{stats.pendingBusinesses}</p>
          </div>
          <div className="card">
            <h3>Reviews</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{stats.reviews}</p>
          </div>
        </div>
      )}
      
      <h2>Pending Businesses</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {businesses.filter(b => !b.isActive).map(business => (
          <div key={business.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>{business.name}</h3>
              <p>{business.city}, {business.state}</p>
            </div>
            <button className="btn-primary" onClick={() => approveBusiness(business.id)}>
              Approve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin;

