import React, { useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Layers,
  Plus,
  Printer,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import {
  ArchivedDocument,
  ArchivedDocumentType,
  BatchPrintItem,
} from '../types/erp';
import { downloadTextFile } from '../utils/export';
import { ScreenProps } from './types';

type LedgerKind = 'all' | 'invoice' | 'return' | 'quotation' | 'purchase_order' | 'voucher' | 'journal';

interface UnifiedLedgerRow {
  key: string;
  id: string;
  kind: Exclude<LedgerKind, 'all'>;
  kindLabel: string;
  party: string;
  summary: string;
  amount: number;
  currency: string;
  status: string;
  dateIso: string;
  printable?: BatchPrintItem;
}

async function compressFileToDataUrl(file: File): Promise<{ dataUrl: string; type: string } | null> {
  if (file.type.startsWith('image/')) {
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (rawDataUrl.length <= 240000) {
      return { dataUrl: rawDataUrl, type: file.type };
    }
    const img = new Image();
    img.src = rawDataUrl;
    await new Promise((res) => {
      img.onload = res;
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(img.width, img.height, 1));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', 0.72);
    return compressed.length <= 245000 ? { dataUrl: compressed, type: 'image/jpeg' } : null;
  }

  if (file.size > 180 * 1024) {
    return null;
  }
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return raw.length <= 245000 ? { dataUrl: raw, type: file.type || 'application/octet-stream' } : null;
}

export const DocumentRegisterScreen: React.FC<ScreenProps> = ({
  store,
  onPrintInvoice,
  onPrintReturn,
  onPrintQuotation,
  onPrintVoucher,
  onOpenBatchPrint,
}) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [activeTab, setActiveTab] = useState<'ledger' | 'archive'>('ledger');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<LedgerKind>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Archive upload/preview state
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | ArchivedDocumentType>('all');
  const [archiveModal, setArchiveModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [previewDoc, setPreviewDoc] = useState<ArchivedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docForm, setDocForm] = useState({
    title: '',
    docType: 'contract' as ArchivedDocumentType,
    partyName: '',
    referenceId: '',
    fileName: '',
    fileType: '',
    fileSizeBytes: 0,
    fileDataBase64: '',
    notes: '',
  });
  const [fileError, setFileError] = useState('');

  const ledgerRows = useMemo<UnifiedLedgerRow[]>(() => {
    const rows: UnifiedLedgerRow[] = [];

    for (const inv of state.invoices) {
      rows.push({
        key: `invoice:${inv.id}`,
        id: inv.id,
        kind: 'invoice',
        kindLabel: isAr ? 'فاتورة ضريبية' : 'Tax Invoice',
        party: inv.customerName,
        summary: inv.description || '—',
        amount: inv.total,
        currency: inv.currency ?? cur,
        status: t[inv.status],
        dateIso: inv.date,
        printable: { kind: 'invoice', data: inv },
      });
    }

    for (const ret of state.returns) {
      rows.push({
        key: `return:${ret.id}`,
        id: ret.id,
        kind: 'return',
        kindLabel: ret.type === 'sales' ? t.salesReturns : t.purchaseReturns,
        party: ret.partyName,
        summary: `${ret.originalDocId} · ${ret.productName}`,
        amount: ret.amount,
        currency: cur,
        status: ret.reason,
        dateIso: ret.date,
        printable: { kind: 'return', data: ret },
      });
    }

    for (const qt of state.quotations) {
      rows.push({
        key: `quotation:${qt.id}`,
        id: qt.id,
        kind: 'quotation',
        kindLabel: isAr ? 'عرض سعر' : 'Quotation',
        party: qt.customerName,
        summary: `${qt.items.length} ${isAr ? 'أصناف' : 'items'}`,
        amount: qt.total,
        currency: cur,
        status: t[qt.status],
        dateIso: qt.date,
        printable: { kind: 'quotation', data: qt },
      });
    }

    for (const po of state.purchaseOrders) {
      rows.push({
        key: `purchase_order:${po.id}`,
        id: po.id,
        kind: 'purchase_order',
        kindLabel: isAr ? 'أمر شراء' : 'Purchase Order',
        party: po.supplierName,
        summary: `${po.productName} ×${po.quantity}`,
        amount: po.total,
        currency: cur,
        status: t[po.status],
        dateIso: po.date,
      });
    }

    for (const v of state.vouchers) {
      rows.push({
        key: `voucher:${v.id}`,
        id: v.id,
        kind: 'voucher',
        kindLabel: v.type === 'receipt' ? t.receiptVoucher : t.paymentVoucher,
        party: v.partyName,
        summary: v.reason || v.paymentMethod,
        amount: v.amount,
        currency: cur,
        status: v.paymentMethod,
        dateIso: v.date,
        printable: { kind: 'voucher', data: v },
      });
    }

    for (const j of state.journals) {
      const totalDebit = j.lines.reduce((s, l) => s + l.debit, 0);
      rows.push({
        key: `journal:${j.id}`,
        id: j.id,
        kind: 'journal',
        kindLabel: isAr ? 'قيد محاسبي' : 'Journal Entry',
        party: j.reference || '—',
        summary: j.description,
        amount: totalDebit,
        currency: cur,
        status: `${j.lines.length} ${isAr ? 'أسطر' : 'lines'}`,
        dateIso: j.date,
      });
    }

    rows.sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
    return rows;
  }, [state.invoices, state.returns, state.quotations, state.purchaseOrders, state.vouchers, state.journals, cur, isAr, t]);

  const filteredLedger = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledgerRows.filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      const datePart = row.dateIso.slice(0, 10);
      if (fromDate && datePart < fromDate) return false;
      if (toDate && datePart > toDate) return false;
      if (!q) return true;
      return (
        row.id.toLowerCase().includes(q) ||
        row.party.toLowerCase().includes(q) ||
        row.summary.toLowerCase().includes(q) ||
        row.kindLabel.toLowerCase().includes(q)
      );
    });
  }, [ledgerRows, kindFilter, fromDate, toDate, search]);

  const printableFiltered = filteredLedger.filter((r) => Boolean(r.printable));
  const selectedPrintableItems: BatchPrintItem[] = filteredLedger
    .filter((r) => selectedKeys.includes(r.key) && r.printable)
    .map((r) => r.printable!);

  const docTypeLabel = (dt: ArchivedDocumentType) => {
    const map: Record<ArchivedDocumentType, string> = {
      contract: t.docTypeContract,
      receipt: t.docTypeReceipt,
      tax_cert: t.docTypeTaxCert,
      id_doc: t.docTypeIdDoc,
      invoice_scan: t.docTypeInvoiceScan,
      other: t.docTypeOther,
    };
    return map[dt];
  };

  const filteredArchive = state.documents.filter((d) => {
    if (docTypeFilter !== 'all' && d.docType !== docTypeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      d.id.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.partyName.toLowerCase().includes(q) ||
      d.referenceId.toLowerCase().includes(q)
    );
  });

  const handlePrintSingleRow = (item: BatchPrintItem) => {
    if (item.kind === 'invoice') onPrintInvoice?.(item.data);
    else if (item.kind === 'return') onPrintReturn?.(item.data);
    else if (item.kind === 'quotation') onPrintQuotation?.(item.data);
    else onPrintVoucher?.(item.data);
  };

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    const result = await compressFileToDataUrl(file);
    if (!result) {
      setFileError(
        isAr
          ? 'حجم الملف كبير جداً (الحد الأقصى للصور المضغوطة والملفات 180 كيلوبايت).'
          : 'File exceeds maximum supported attachment size (180 KB after compression).',
      );
      return;
    }
    setDocForm((f) => ({
      ...f,
      fileName: file.name,
      fileType: result.type,
      fileSizeBytes: file.size,
      fileDataBase64: result.dataUrl,
      title: f.title || file.name.replace(/\.[^.]+$/, ''),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation tabs + Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'ledger' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.systemDocumentsTab} ({ledgerRows.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'archive' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>{t.archivedFilesTab} ({state.documents.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'ledger' ? (
            <>
              <button
                onClick={() => {
                  const csvRows = [
                    ['ID', 'Type', 'Party', 'Summary', 'Amount', 'Currency', 'Status', 'Date'],
                    ...filteredLedger.map((r) => [
                      r.id,
                      r.kindLabel,
                      r.party,
                      r.summary,
                      r.amount.toFixed(2),
                      r.currency,
                      r.status,
                      r.dateIso.slice(0, 10),
                    ]),
                  ];
                  const csvText = csvRows
                    .map((row) =>
                      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','),
                    )
                    .join('\n');
                  downloadTextFile('ostora_document_register.csv', csvText);
                  actions.notify(isAr ? 'تم تصدير سجل المستندات CSV' : 'Document register exported to CSV');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{t.exportCsv}</span>
              </button>
              {selectedPrintableItems.length > 0 && (
                <button
                  onClick={() => onOpenBatchPrint?.(selectedPrintableItems)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>{t.batchPrintSelected} ({selectedPrintableItems.length})</span>
                </button>
              )}
              {printableFiltered.length > 0 && (
                <button
                  onClick={() => onOpenBatchPrint?.(printableFiltered.map((r) => r.printable!))}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white font-bold text-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.batchPrintFiltered} ({printableFiltered.length})</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setFileError('');
                setDocForm({
                  title: '',
                  docType: 'contract',
                  partyName: '',
                  referenceId: '',
                  fileName: '',
                  fileType: '',
                  fileSizeBytes: 0,
                  fileDataBase64: '',
                  notes: '',
                });
                setArchiveModal({ open: true });
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.uploadDocument}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>

        {activeTab === 'ledger' ? (
          <>
            <select
              value={kindFilter}
              onChange={(e) => {
                setKindFilter(e.target.value as LedgerKind);
                setSelectedKeys([]);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="all">{t.documentTypeAll}</option>
              <option value="invoice">{t.invoices}</option>
              <option value="return">{t.returns}</option>
              <option value="quotation">{t.quotations}</option>
              <option value="purchase_order">{t.purchase_orders}</option>
              <option value="voucher">{t.vouchers}</option>
              <option value="journal">{t.journals}</option>
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label={t.fromDate}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label={t.toDate}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
            {printableFiltered.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedPrintableItems.length === printableFiltered.length) {
                    setSelectedKeys([]);
                  } else {
                    setSelectedKeys(printableFiltered.map((r) => r.key));
                  }
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
              >
                {selectedPrintableItems.length === printableFiltered.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{t.clearSelection}</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>{t.selectAll}</span>
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value as 'all' | ArchivedDocumentType)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="all">{t.documentTypeAll}</option>
            <option value="contract">{t.docTypeContract}</option>
            <option value="receipt">{t.docTypeReceipt}</option>
            <option value="tax_cert">{t.docTypeTaxCert}</option>
            <option value="id_doc">{t.docTypeIdDoc}</option>
            <option value="invoice_scan">{t.docTypeInvoiceScan}</option>
            <option value="other">{t.docTypeOther}</option>
          </select>
        )}
      </div>

      {/* Main Content */}
      {activeTab === 'ledger' ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-x-auto">
          {filteredLedger.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
          ) : (
            <table className="w-full text-xs sm:text-sm min-w-[780px]">
              <thead className="bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 border-b border-slate-200 dark:border-[#1F332B]">
                <tr>
                  <th className="p-3 w-10 text-center">—</th>
                  <th className="p-3 text-start">ID</th>
                  <th className="p-3 text-start">{t.docTypeLabel}</th>
                  <th className="p-3 text-start">{t.partyNameLabel}</th>
                  <th className="p-3 text-start">{t.reason}</th>
                  <th className="p-3 text-end">{t.amount}</th>
                  <th className="p-3 text-start">{t.date}</th>
                  <th className="p-3 text-end">—</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                {filteredLedger.map((row) => {
                  const checked = selectedKeys.includes(row.key);
                  return (
                    <tr key={row.key} className="hover:bg-slate-50/70 dark:hover:bg-[#182821]">
                      <td className="p-3 text-center">
                        {row.printable ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectKey(row.key)}
                            aria-label={`Select ${row.id}`}
                            className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-300">{row.id}</td>
                      <td className="p-3 font-bold text-[#0A3D2C] dark:text-[#C9A227]">{row.kindLabel}</td>
                      <td className="p-3 font-semibold">{row.party}</td>
                      <td className="p-3 text-slate-500 max-w-[220px] truncate">{row.summary}</td>
                      <td className="p-3 text-end font-mono font-extrabold tabular-nums">
                        {row.amount.toFixed(2)} {row.currency}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500">{row.dateIso.slice(0, 10)}</td>
                      <td className="p-3 text-end">
                        {row.printable && (
                          <button
                            type="button"
                            onClick={() => handlePrintSingleRow(row.printable!)}
                            title={t.printPdf}
                            className="p-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : filteredArchive.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArchive.map((d) => (
            <div
              key={d.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-slate-500">
                  {d.id} · {docTypeLabel(d.docType)}
                </span>
                <span className="font-mono text-slate-400">{d.date.slice(0, 10)}</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] flex items-center justify-center shrink-0">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-sm sm:text-base truncate">{d.title}</h4>
                  <p className="text-xs text-slate-500 truncate">
                    {d.partyName || '—'} {d.referenceId ? `· ${d.referenceId}` : ''}
                  </p>
                  {d.fileName && (
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                      {d.fileName} ({(d.fileSizeBytes / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>

              {d.notes && <p className="text-xs text-slate-500">{d.notes}</p>}

              <div className="pt-2 border-t border-slate-100 dark:border-[#1F332B] flex items-center gap-2">
                {d.fileDataBase64 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(d)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t.previewAttachment}</span>
                    </button>
                    <a
                      href={d.fileDataBase64}
                      download={d.fileName || `${d.id}.bin`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.downloadAttachment}</span>
                    </a>
                  </>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      actions.deleteArchivedDocument(d.id);
                      actions.notify(isAr ? 'تم حذف المستند من الأرشيف' : 'Document removed from archive');
                    }}
                    aria-label={t.delete}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archive Document Modal */}
      {archiveModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{t.uploadDocument}</h3>

            <input
              type="text"
              maxLength={160}
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
              placeholder={isAr ? 'عنوان المستند' : 'Document Title'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={docForm.docType}
                onChange={(e) => setDocForm({ ...docForm, docType: e.target.value as ArchivedDocumentType })}
                className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
              >
                <option value="contract">{t.docTypeContract}</option>
                <option value="receipt">{t.docTypeReceipt}</option>
                <option value="tax_cert">{t.docTypeTaxCert}</option>
                <option value="id_doc">{t.docTypeIdDoc}</option>
                <option value="invoice_scan">{t.docTypeInvoiceScan}</option>
                <option value="other">{t.docTypeOther}</option>
              </select>
              <input
                type="text"
                maxLength={128}
                value={docForm.referenceId}
                onChange={(e) => setDocForm({ ...docForm, referenceId: e.target.value })}
                placeholder={t.referenceIdLabel}
                className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
              />
            </div>

            <input
              type="text"
              maxLength={160}
              value={docForm.partyName}
              onChange={(e) => setDocForm({ ...docForm, partyName: e.target.value })}
              placeholder={t.partyNameLabel}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="border border-dashed border-slate-300 dark:border-[#1F332B] rounded-xl p-3 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.csv,.json"
                onChange={(e) => void handleFileChange(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{t.attachmentLabel}</span>
              </button>
              {docForm.fileName && (
                <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400 text-center truncate">
                  {docForm.fileName} ({(docForm.fileSizeBytes / 1024).toFixed(1)} KB)
                </p>
              )}
              {fileError && <p className="text-xs font-bold text-red-600">{fileError}</p>}
            </div>

            <textarea
              rows={2}
              maxLength={500}
              value={docForm.notes}
              onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
              placeholder={t.notes}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setArchiveModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (!docForm.title.trim()) return;
                  actions.saveArchivedDocument(
                    {
                      title: docForm.title.trim(),
                      docType: docForm.docType,
                      partyName: docForm.partyName.trim(),
                      referenceId: docForm.referenceId.trim(),
                      fileName: docForm.fileName.trim(),
                      fileType: docForm.fileType.trim(),
                      fileSizeBytes: docForm.fileSizeBytes,
                      fileDataBase64: docForm.fileDataBase64 || undefined,
                      notes: docForm.notes.trim(),
                      date: new Date().toISOString(),
                    },
                    archiveModal.editId,
                  );
                  setArchiveModal({ open: false });
                  actions.notify(
                    isAr ? 'تم حفظ المستند في الأرشيف بنجاح' : 'Document archived successfully',
                  );
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Attachment Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-xl w-full p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm truncate">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500 font-mono truncate">{previewDoc.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {previewDoc.fileDataBase64?.startsWith('data:image/') ? (
              <img
                src={previewDoc.fileDataBase64}
                alt={previewDoc.title}
                className="max-h-[65vh] w-full object-contain rounded-xl border border-slate-200 dark:border-[#1F332B]"
              />
            ) : previewDoc.fileDataBase64 ? (
              <iframe
                src={previewDoc.fileDataBase64}
                title={previewDoc.title}
                className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
