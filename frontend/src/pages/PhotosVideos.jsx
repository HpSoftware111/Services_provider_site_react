import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './PhotosVideos.css';

const PhotosVideos = () => {
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetchBusiness();
  }, []);

  // Helper function to normalize array data (handles JSON strings, null, undefined, etc.)
  const normalizeArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const fetchBusiness = async () => {
    try {
      const response = await api.get('/businesses/my-businesses');
      const businesses = response.data.businesses || [];
      if (businesses.length > 0) {
        const biz = businesses[0];
        setBusiness(biz);
        setPhotos(normalizeArray(biz.images));
        setVideos(normalizeArray(biz.videos));
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    if (photos.length + files.length > 10) {
      alert('Maximum 10 photos allowed');
      return;
    }

    setUploading(true);
    const newPhotos = [];

    for (let file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        continue;
      }

      if (file.size > 2 * 1024 * 1024) {
        alert(`File ${file.name} is too large (max 2MB)`);
        continue;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        newPhotos.push(reader.result);
        if (newPhotos.length === Math.min(files.length, 10 - photos.length)) {
          setPhotos([...photos, ...newPhotos]);
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleVideoAdd = () => {
    const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
    if (url && videos.length < 5) {
      setVideos([...videos, url]);
    } else if (videos.length >= 5) {
      alert('Maximum 5 videos allowed');
    }
  };

  const removeVideo = (index) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const saveChanges = async () => {
    if (!business) return;

    try {
      setUploading(true);
      await api.put(`/businesses/${business.id}`, {
        images: photos,
        videos: videos
      });
      alert('Photos and videos saved successfully!');
    } catch (error) {
      alert('Failed to save changes');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="photos-videos-page">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="photos-videos-page">
      <div className="page-header">
        <h1 className="page-title">Upload and manage photos</h1>
        <p className="page-subtitle">
          Add real images of your business to help customers find and recognize your location. 
          High-quality photos can increase engagement and trust.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="upload-section">
        <div
          className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="upload-content">
            <i className="fas fa-cloud-upload-alt"></i>
            <p className="upload-text">Drag & drop files here…</p>
            <p className="upload-hint">or</p>
            <label className="browse-button">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                style={{ display: 'none' }}
                disabled={uploading}
              />
              Browse…
            </label>
            <p className="upload-info">
              Add up to 10 photos. Use real images of your company.
            </p>
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length > 0 && (
        <div className="media-section">
          <h3 className="section-title">Your Photos ({photos.length}/10)</h3>
          <div className="photos-grid">
            {photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img src={photo} alt={`Business ${index + 1}`} />
                <button
                  className="remove-photo-btn"
                  onClick={() => removePhoto(index)}
                  title="Remove photo"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      <div className="media-section">
        <h3 className="section-title">Videos ({videos.length}/5)</h3>
        {videos.length > 0 ? (
          <div className="videos-list">
            {videos.map((video, index) => (
              <div key={index} className="video-item">
                <i className="fas fa-play-circle"></i>
                <span className="video-url">{video}</span>
                <button
                  className="remove-video-btn"
                  onClick={() => removeVideo(index)}
                  title="Remove video"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">No videos added yet.</p>
        )}
        {videos.length < 5 && (
          <button className="add-video-btn" onClick={handleVideoAdd}>
            <i className="fas fa-plus"></i> Add Video URL
          </button>
        )}
      </div>

      {/* Save Button */}
      {(photos.length > 0 || videos.length > 0) && (
        <div className="save-section">
          <button
            className="save-button"
            onClick={saveChanges}
            disabled={uploading}
          >
            {uploading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotosVideos;
