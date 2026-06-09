import React, { useState, useRef } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  const triggerBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={`upload-zone ${isDragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerBrowse}
    >
      <span className="upload-icon">📥</span>
      <h3>Drag & Drop Contract</h3>
      <p>Support PDF, DOCX, PNG, JPG, or JPEG (Max 50MB)</p>
      
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="file-input" 
        style={{ display: 'none' }}
        multiple 
        accept=".pdf,.docx,.png,.jpg,.jpeg"
      />
      
      <button 
        type="button" 
        className="btn-primary"
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggerBrowse from running twice
          triggerBrowse();
        }}
      >
        Browse Files
      </button>
    </div>
  );
};
