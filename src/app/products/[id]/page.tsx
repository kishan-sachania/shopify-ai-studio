'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Edit3,
  ArrowUpRight,
  Trash2,
  Package,
  Layers,
  DollarSign,
  Tag,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Calendar,
  FileText,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useLocalStorageProducts } from '@/hooks/useLocalStorageProducts';
import { useShopifyPush } from '@/hooks/useShopifyPush';
import { Badge } from '@/components/common/Badge';
import { ProductEditDrawer } from '@/components/products/ProductEditDrawer';
import { ExtractedProduct } from '@/types/product';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const { products, isLoaded, updateProduct, updateProductStatus, deleteProduct } =
    useLocalStorageProducts();

  const product = products.find((p) => p.id === id);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPushingLocal, setIsPushingLocal] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [streamedDesc, setStreamedDesc] = useState<string | null>(null);
  const [pushFeedback, setPushFeedback] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const { pushSingleProduct } = useShopifyPush();

  const handleGenerateDescription = async () => {
    if (!product || isGeneratingDesc) return;
    setIsGeneratingDesc(true);
    setPushFeedback(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          title: product.title,
          variant_or_flavor: product.variant_or_flavor,
          vendor: product.vendor,
          productType: product.productType,
          tags: product.tags,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) {
        throw new Error(data.error || 'Failed to generate description');
      }

      const generatedSentence: string = data.text;
      const existingHtml = product.descriptionHtml ? product.descriptionHtml.trim() : '';
      const prefix = existingHtml && existingHtml !== `<p>${product.title}</p>` && existingHtml !== '<p></p>'
        ? `${existingHtml}\n`
        : '';

      // Stream / typewriter effect letter-by-letter
      let currentAppended = '';
      for (let i = 0; i < generatedSentence.length; i++) {
        currentAppended += generatedSentence[i];
        setStreamedDesc(`${prefix}<p>${currentAppended}</p>`);
        await new Promise((r) => setTimeout(r, 16));
      }

      const finalHtml = `${prefix}<p>${generatedSentence}</p>`;
      updateProduct(product.id, { descriptionHtml: finalHtml });
      setStreamedDesc(null);
      setPushFeedback({
        success: true,
        message: 'AI product description generated and appended successfully!',
      });
    } catch (err: any) {
      setPushFeedback({
        success: false,
        message: `AI Generation error: ${err.message}`,
      });
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handlePush = async () => {
    if (!product) return;
    setIsPushingLocal(true);
    setPushFeedback(null);

    const res = await pushSingleProduct(product);
    setIsPushingLocal(false);

    if (res?.success) {
      updateProductStatus(product.id, 'PUSHED', {
        shopifyId: res.shopifyId,
        shopifyHandle: res.shopifyHandle,
        shopifyUrl: res.shopifyUrl,
      });
      setPushFeedback({
        success: true,
        message: `Product successfully pushed to Shopify! (ID: ${res.shopifyId})`,
      });
    } else {
      const errorMsg = res?.errors?.join(', ') || 'Failed to push product';
      updateProductStatus(product.id, 'ERROR', {
        errors: res?.errors || [errorMsg],
      });
      setPushFeedback({
        success: false,
        message: errorMsg,
      });
    }
  };

  const handleDelete = () => {
    if (!product) return;
    if (confirm('Are you sure you want to remove this product from local storage?')) {
      deleteProduct(product.id);
      router.push('/products');
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested product ID <code className="bg-slate-100 px-1 py-0.5 rounded">{id}</code> does not exist in local storage.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </Link>
      </div>
    );
  }

  const currentImage = product.images?.[selectedImageIndex] || product.image_url;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products Catalog
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {product.shopify_product_url && (
            <a
              href={product.shopify_product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View in Shopify
            </a>
          )}

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>

          <button
            onClick={handlePush}
            disabled={isPushingLocal}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition"
          >
            {isPushingLocal ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5" />
            )}
            Push to Shopify
          </button>
        </div>
      </div>

      {/* Push Feedback Alert */}
      {pushFeedback && (
        <div
          className={`flex items-center gap-2 p-4 rounded-xl border text-sm ${
            pushFeedback.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {pushFeedback.success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{pushFeedback.message}</span>
        </div>
      )}

      {/* Main Grid: Left Gallery & Right Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Gallery (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative aspect-square w-full rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
              {currentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt={product.title}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="h-12 w-12 stroke-[1.5]" />
                  <span className="text-xs mt-2">No Image Available</span>
                </div>
              )}
            </div>

            {/* Thumbnail carousel */}
            {product.images && product.images.length > 1 && (
              <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                      selectedImageIndex === idx
                        ? 'border-emerald-600 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Excel / Task Sheet Attributes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Excel Task Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block">Task Status</span>
                <span className="font-semibold text-slate-700">{product.task_status || 'N/A'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block">Action</span>
                <span className="font-semibold text-slate-700">{product.action || 'Create Product'}</span>
              </div>
            </div>

            {product.source_url && (
              <div className="pt-1">
                <span className="text-xs text-slate-400 block mb-1">Source URL</span>
                <a
                  href={product.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline flex items-center gap-1 truncate"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{product.source_url}</span>
                </a>
              </div>
            )}

            {product.notes && (
              <div className="pt-1">
                <span className="text-xs text-slate-400 block mb-1">Notes</span>
                <p className="text-xs text-slate-600 bg-amber-50/70 p-2.5 rounded-lg border border-amber-100">
                  {product.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Product Details & Metrics (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge status={product.status} />
                  {product.variant_or_flavor && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 font-medium">
                      {product.variant_or_flavor}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                  {product.title}
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-1">ID: {product.id}</p>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <DollarSign className="h-4 w-4" />
                  Price
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  ${Number(product.price).toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <Package className="h-4 w-4 text-slate-400" />
                  Stock
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {product.inventoryQuantity}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <Layers className="h-4 w-4 text-slate-400" />
                  Vendor
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1 truncate" title={product.vendor}>
                  {product.vendor || '—'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <Tag className="h-4 w-4 text-slate-400" />
                  Type
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-1 truncate" title={product.productType}>
                  {product.productType || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Collections */}
            {product.collections && product.collections.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 block mb-2 font-medium">Collections</span>
                <div className="flex flex-wrap gap-1.5">
                  {product.collections.map((col, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 block mb-2 font-medium">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description Viewer Tabs */}
          <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-all duration-300 ${
            isGeneratingDesc ? 'border-purple-400 ring-2 ring-purple-200' : 'border-slate-200'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800">Product Description</h3>
                {isGeneratingDesc && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                    <Sparkles className="h-3 w-3 animate-spin" />
                    Generating & Appending...
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-purple-200" />
                      <span>Generate Description</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 font-medium rounded-md transition ${
                      activeTab === 'preview'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Formatted Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('html')}
                    className={`px-3 py-1 font-medium rounded-md transition ${
                      activeTab === 'html'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    HTML Source
                  </button>
                </div>
              </div>
            </div>

            <div className={`p-6 transition-opacity ${isGeneratingDesc ? 'opacity-90' : 'opacity-100'}`}>
              {activeTab === 'preview' ? (
                <div
                  className="prose prose-sm max-w-none text-slate-700 min-h-[140px]"
                  dangerouslySetInnerHTML={{
                    __html: streamedDesc || product.descriptionHtml || '<p class="text-slate-400">No description provided</p>',
                  }}
                />
              ) : (
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-96">
                  {streamedDesc || product.descriptionHtml || '(Empty)'}
                </pre>
              )}
            </div>
          </div>

          {/* Sync History / Errors Card */}
          {product.errorMessages && product.errorMessages.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs uppercase tracking-wider">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                Push Errors Log
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-700">
                {product.errorMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Edit Drawer */}
      <ProductEditDrawer
        product={product}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(updated) => updateProduct(product.id, updated)}
      />
    </div>
  );
}
