'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Plus,
  Info,
  ChevronDown,
  Tag as TagIcon,
  FolderPlus,
  ImageIcon,
  DollarSign,
  Package,
  Layers,
  FileText,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ExtractedProduct } from '@/types/product';

interface ProductEditDrawerProps {
  product: ExtractedProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: ExtractedProduct) => void;
}

export function ProductEditDrawer({
  product,
  isOpen,
  onClose,
  onSave,
}: ProductEditDrawerProps) {
  const [form, setForm] = useState<ExtractedProduct | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [newCollectionInput, setNewCollectionInput] = useState('');
  const [showCollectionInput, setShowCollectionInput] = useState(false);
  const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit');
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const collectionInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateDescription = async () => {
    if (!form || isGeneratingDesc) return;
    setIsGeneratingDesc(true);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          variant_or_flavor: form.variant_or_flavor,
          vendor: form.vendor,
          productType: form.productType,
          tags: form.tags,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) {
        throw new Error(data.error || 'Failed to generate description');
      }

      const generatedSentence: string = data.text;
      const existingHtml = form.descriptionHtml ? form.descriptionHtml.trim() : '';
      const prefix = existingHtml && existingHtml !== `<p>${form.title}</p>` && existingHtml !== '<p></p>'
        ? `${existingHtml}\n`
        : '';

      // Stream / typewriter letter-by-letter
      let currentAppended = '';
      for (let i = 0; i < generatedSentence.length; i++) {
        currentAppended += generatedSentence[i];
        setForm((prev) =>
          prev ? { ...prev, descriptionHtml: `${prefix}<p>${currentAppended}</p>` } : null
        );
        await new Promise((r) => setTimeout(r, 16));
      }

      setForm((prev) =>
        prev ? { ...prev, descriptionHtml: `${prefix}<p>${generatedSentence}</p>` } : null
      );
    } catch (err: any) {
      alert(`AI Generation error: ${err.message}`);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  // Sync mount and animate states with isOpen
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (isMounted) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 250);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMounted]);

  // Animated close handler
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsMounted(false);
      setIsClosing(false);
      document.body.style.overflow = '';
    }, 250);
  };

  // Sync form state whenever product changes
  useEffect(() => {
    if (product) {
      setForm({
        ...product,
        tags: Array.isArray(product.tags) ? [...product.tags] : [],
        collections: Array.isArray(product.collections) ? [...product.collections] : [],
        images: Array.isArray(product.images) ? [...product.images] : [],
      });
      setShowTagInput(false);
      setShowCollectionInput(false);
      setNewTagInput('');
      setNewCollectionInput('');
    }
  }, [product]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMounted && !isClosing) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, isClosing]);

  if (!isMounted || !form) return null;

  const handleChange = (field: keyof ExtractedProduct, val: any) => {
    setForm((prev) => (prev ? { ...prev, [field]: val } : null));
  };

  // Tag Management
  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed || !form) return;
    if (!form.tags.includes(trimmed)) {
      setForm({ ...form, tags: [...form.tags, trimmed] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!form) return;
    setForm({
      ...form,
      tags: form.tags.filter((t) => t !== tagToRemove),
    });
  };

  // Collection Management
  const handleAddCollection = () => {
    const trimmed = newCollectionInput.trim();
    if (!trimmed || !form) return;
    const current = form.collections || [];
    if (!current.includes(trimmed)) {
      setForm({ ...form, collections: [...current, trimmed] });
    }
    setNewCollectionInput('');
  };

  const handleRemoveCollection = (collToRemove: string) => {
    if (!form) return;
    setForm({
      ...form,
      collections: (form.collections || []).filter((c) => c !== collToRemove),
    });
  };

  // Images Management
  const handleImagesTextChange = (text: string) => {
    if (!form) return;
    const urls = text
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));
    setForm({ ...form, images: urls, image_url: text });
  };

  const handleRemoveImage = (index: number) => {
    if (!form) return;
    const updatedImages = form.images.filter((_, i) => i !== index);
    setForm({ ...form, images: updatedImages, image_url: updatedImages.join('\n') });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form) {
      onSave(form);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop with fade-in / fade-out */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm ${
          isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
      />

      {/* Drawer Container (Sliding from Right with tailwind animation) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          className={`w-screen max-w-xl sm:max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 ${
            isClosing ? 'animate-drawer-out' : 'animate-drawer-in'
          }`}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Edit Product</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{form.id}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition"
              title="Close drawer (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Scrollable Body */}
          <form id="productEditForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {form.errorMessages && form.errorMessages.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Previous Push Errors:</strong>
                  {form.errorMessages.map((e, idx) => (
                    <p key={idx} className="mt-0.5">{e}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: General Product Information */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                General Information
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g. Flavour Beast Level X Device Kit"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Variant / Flavor
                  </label>
                  <input
                    type="text"
                    value={form.variant_or_flavor || ''}
                    onChange={(e) => handleChange('variant_or_flavor', e.target.value)}
                    placeholder="e.g. Matte Black"
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.inventoryQuantity}
                    onChange={(e) => handleChange('inventoryQuantity', parseInt(e.target.value) || 0)}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Product Organization (MATCHING SCREENSHOT) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 text-slate-900 font-semibold text-sm">
                <span>Product organization</span>
                <span title="Organize your products with type, vendor, collections, and tags">
                  <Info className="h-4 w-4 text-slate-400 stroke-[2] cursor-help" />
                </span>
              </div>

              {/* Type Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Type</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.productType || ''}
                    onChange={(e) => handleChange('productType', e.target.value)}
                    placeholder="e.g. Vape Devices"
                    className="w-full text-sm rounded-xl border border-slate-300 pl-3.5 pr-9 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-xs"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Vendor Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Vendor</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.vendor || ''}
                    onChange={(e) => handleChange('vendor', e.target.value)}
                    placeholder="e.g. testerhub"
                    className="w-full text-sm rounded-xl border border-slate-300 pl-3.5 pr-9 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-xs"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Collections Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Collections</label>
                <div className="min-h-[46px] rounded-xl border border-slate-300 p-2 bg-white flex flex-wrap items-center gap-1.5 shadow-xs">
                  {form.collections && form.collections.length > 0 ? (
                    form.collections.map((coll, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200"
                      >
                        {coll}
                        <button
                          type="button"
                          onClick={() => handleRemoveCollection(coll)}
                          className="text-slate-400 hover:text-rose-600 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  ) : null}

                  {showCollectionInput ? (
                    <div className="inline-flex items-center gap-1">
                      <input
                        ref={collectionInputRef}
                        type="text"
                        value={newCollectionInput}
                        onChange={(e) => setNewCollectionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCollection();
                          } else if (e.key === 'Escape') {
                            setShowCollectionInput(false);
                          }
                        }}
                        placeholder="Collection name..."
                        className="text-xs px-2 py-1 rounded border border-emerald-500 outline-none w-36"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCollection}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCollectionInput(true);
                        setTimeout(() => collectionInputRef.current?.focus(), 50);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-500" />
                      Add collections
                    </button>
                  )}
                </div>
              </div>

              {/* Tags Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">Tags</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTagInput(true);
                      setTimeout(() => tagInputRef.current?.focus(), 50);
                    }}
                    className="text-slate-500 hover:text-slate-800 transition"
                    title="Add new tag"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-[50px] rounded-xl border border-slate-300 p-2.5 bg-white flex flex-wrap items-center gap-1.5 shadow-xs">
                  {form.tags && form.tags.length > 0 ? (
                    form.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-slate-400 hover:text-rose-600 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    !showTagInput && (
                      <span className="text-xs text-slate-400 italic">No tags added yet.</span>
                    )
                  )}

                  {showTagInput && (
                    <div className="inline-flex items-center gap-1">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          } else if (e.key === 'Escape') {
                            setShowTagInput(false);
                          }
                        }}
                        placeholder="Tag name..."
                        className="text-xs px-2 py-1 rounded border border-emerald-500 outline-none w-32"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: HTML Description */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Description
                  </h3>
                  {isGeneratingDesc && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                      <Sparkles className="h-3 w-3 animate-spin" />
                      Generating AI text...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDesc}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title="Generate concise description using Groq AI"
                  >
                    {isGeneratingDesc ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 text-purple-200" />
                        <span>Generate Description</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setDescTab('edit')}
                      className={`px-2.5 py-1 rounded font-medium ${
                        descTab === 'edit'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      HTML Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescTab('preview')}
                      className={`px-2.5 py-1 rounded font-medium ${
                        descTab === 'preview'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Live Preview
                    </button>
                  </div>
                </div>
              </div>

              {descTab === 'edit' ? (
                <textarea
                  rows={4}
                  disabled={isGeneratingDesc}
                  value={form.descriptionHtml}
                  onChange={(e) => handleChange('descriptionHtml', e.target.value)}
                  placeholder="<p>Detailed product description...</p>"
                  className={`w-full text-xs font-mono rounded-xl border p-3 outline-none transition-all ${
                    isGeneratingDesc
                      ? 'bg-purple-50/50 border-purple-300 text-slate-500 cursor-not-allowed'
                      : 'border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
              ) : (
                <div
                  className={`prose prose-sm max-w-none p-3.5 rounded-xl border bg-slate-50/60 min-h-[96px] text-xs text-slate-700 transition-all ${
                    isGeneratingDesc ? 'border-purple-300 ring-2 ring-purple-100' : 'border-slate-200'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: form.descriptionHtml || '<p class="text-slate-400">No description provided</p>',
                  }}
                />
              )}
            </div>

            {/* Section 4: Images & Media */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Product Images
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Image URLs (One per line)
                </label>
                <textarea
                  rows={3}
                  value={form.images.join('\n')}
                  onChange={(e) => handleImagesTextChange(e.target.value)}
                  placeholder="https://example.com/image1.jpg"
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              {form.images && form.images.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {form.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-lg border border-slate-200 bg-slate-50 overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-white/90 text-rose-600 rounded shadow opacity-0 group-hover:opacity-100 transition"
                        title="Remove image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Task / Excel Extra Info */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Task & Excel Sheet Metadata
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Task Status</label>
                  <input
                    type="text"
                    value={form.task_status || ''}
                    onChange={(e) => handleChange('task_status', e.target.value)}
                    placeholder="e.g. In Progress"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Action</label>
                  <input
                    type="text"
                    value={form.action || ''}
                    onChange={(e) => handleChange('action', e.target.value)}
                    placeholder="e.g. Create Product"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Source URL</label>
                <input
                  type="url"
                  value={form.source_url || ''}
                  onChange={(e) => handleChange('source_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Task notes..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2"
                />
              </div>
            </div>
          </form>

          {/* Drawer Footer (Sticky) */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 hover:bg-slate-200/80 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="productEditForm"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
