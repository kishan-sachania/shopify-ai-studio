'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ExtractedProduct, ExtractionSummary } from '@/types/product';

interface FileDropzoneProps {
  onExtractionSuccess: (products: ExtractedProduct[], summary: ExtractionSummary) => void;
}

export function FileDropzone({ onExtractionSuccess }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processUpload = async (formData: FormData) => {
    setIsProcessing(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract Excel products');
      }

      setSuccessInfo(`Extracted ${data.count} valid products successfully.`);
      onExtractionSuccess(data.products, data.summary);
    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setError('Please drop a valid Excel file (.xlsx or .xls)');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      await processUpload(formData);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      await processUpload(formData);
    }
  };

  const handleLoadSampleSheet = async () => {
    const formData = new FormData();
    formData.append('loadSample', 'true');
    await processUpload(formData);
  };

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer text-center ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 bg-white shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="rounded-full bg-emerald-50 p-4 text-emerald-600 mb-3">
          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <UploadCloud className="h-8 w-8" />
          )}
        </div>

        <h3 className="text-base font-semibold text-slate-800">
          {isProcessing ? 'Extracting Products from Workbook...' : 'Upload Excel Sheet'}
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Drag and drop your <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">.xlsx</code> product file here, or click to browse
        </p>

        <span className="mt-4 text-xs font-medium text-slate-400">
          Supports multi-column task sheets with auto column mapping
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Need quick testing?</span>
        <button
          type="button"
          onClick={handleLoadSampleSheet}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 font-medium text-emerald-600 hover:text-emerald-700 hover:underline disabled:opacity-50"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Load project sample sheet (product_task_sheet.xlsx)
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successInfo && (
        <div className="flex items-center gap-2 p-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successInfo}</span>
        </div>
      )}
    </div>
  );
}
