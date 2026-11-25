import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { strings } from '../data/translations';
import { ErpStore } from '../screens/types';
import { Customer, Product, Supplier } from '../types/erp';
import {
  getSampleCsvTemplate,
  getSampleJsonTemplate,
  ImportEntityType,
  validateBulkImportData,
} from '../utils/dataImport';
import { downloadTextFile } from '../utils/export';

interface DataImportModalProps {
  open: boolean;
  defaultEntity?: ImportEntityType;
  allowEntitySwitch?: boolean;
  store: ErpStore;
  onClose: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  open,
  defaultEntity = 'customers',
  allowEntitySwitch = true,
  store,
  onClose,
}) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [entity, setEntity] = useState<ImportEntityType>(defaultEntity);
  const [rawInput, setRawInput] = useState('');
  const [fileName, setFileName] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setEntity(defaultEntity);
      setRawInput('');
      setFileName('');
      setSkipDuplicates(true);
    }
  }, [open, defaultEntity]);

  const validation = useMemo(() => {
    if (!rawInput.trim()) return null;
    return validateBulkImportData(
      rawInput,
      entity,
      {
        customers: state.customers,
        suppliers: state.suppliers,
        products: state.products,
      },
      fileName || undefined,
    );
  }, [rawInput, entity, fileName, state.customers, state.suppliers, state.products]);

  const importableRows = useMemo(() => {
    if (!validation) return [];
    return validation.rows.filter(
      (r) => r.payload && r.status !== 'error' && (!skipDuplicates || !r.isDuplicate),
    );
  }, [validation, skipDuplicates]);

  if (!open) return null;

  const entityOptions: { id: ImportEntityType; label: string }[] = [
    { id: 'customers', label: t.customers },
    { id: 'suppliers', label: t.suppliers },
    { id: 'products', label: t.inventory },
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      setFileName(file.name);
      setRawInput(content);
    } catch {
      actions.notify(isAr ? 'تعذر قراءة الملف المحدد' : 'Could not read selected file');
    }
  };

  const handleConfirmImport = () => {
    if (importableRows.length === 0) return;

    let count = 0;
    if (entity === 'customers') {
      const records = importableRows
        .map((r) => r.payload)
        .filter((p): p is { entity: 'customers'; record: Omit<Customer, 'id'> } => p?.entity === 'customers')
        .map((p) => p.record);
      count = actions.importCustomersBulk(records);
    } else if (entity === 'suppliers') {
      const records = importableRows
        .map((r) => r.payload)
        .filter((p): p is { entity: 'suppliers'; record: Omit<Supplier, 'id'> } => p?.entity === 'suppliers')
        .map((p) => p.record);
      count = actions.importSuppliersBulk(records);
    } else {
      const records = importableRows
        .map((r) => r.payload)
        .filter((p): p is { entity: 'products'; record: Omit<Product, 'id'> } => p?.entity === 'products')
        .map((p) => p.record);
      count = actions.importProductsBulk(records);
    }

    actions.notify(
      isAr
        ? `تم استيراد ${count} سجل بنجاح بعد التحقق`
        : `Successfully imported ${count} validated records`,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-5 sm:p-6 space-y-4 my-auto shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold">{t.dataImportTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.pasteDataHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entity Switcher + Sample Templates */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {allowEntitySwitch ? (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
              {entityOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEntity(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    entity === opt.id
                      ? 'bg-[#0A3D2C] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-500">
              {t.importEntityType}: {entityOptions.find((e) => e.id === entity)?.label}
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                downloadTextFile(`sample_${entity}.csv`, getSampleCsvTemplate(entity), 'text/csv;charset=utf-8');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2C24] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.downloadSampleCsv}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                downloadTextFile(`sample_${entity}.json`, getSampleJsonTemplate(entity), 'application/json');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2C24] cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <span>{t.downloadSampleJson}</span>
            </button>
          </div>
        </div>

        {/* Upload Bar + Paste Area */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{t.uploadCsvOrJson}</span>
            </button>
            {fileName && (
              <span className="text-xs font-mono text-slate-500 truncate max-w-xs">
                {fileName}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <textarea
            rows={4}
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              if (!e.target.value) setFileName('');
            }}
            placeholder={getSampleCsvTemplate(entity)}
            dir="ltr"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono outline-none focus:border-[#0A3D2C]"
          />
        </div>

        {/* Validation Results Step */}
        {validation && (
          <div className="space-y-3 border-t border-slate-200 dark:border-[#1F332B] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-extrabold">{t.validationSummary}</h4>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
                <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{validation.validCount} {t.validRowsLabel}</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{validation.warningCount} {t.warningRowsLabel}</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{validation.errorCount} {t.errorRowsLabel}</span>
                </span>
              </div>
            </div>

            {validation.parseErrorAr ? (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{isAr ? validation.parseErrorAr : validation.parseErrorEn}</span>
              </div>
            ) : (
              <>
                {validation.duplicateCount > 0 && (
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
                    />
                    <span>{t.skipDuplicates} ({validation.duplicateCount})</span>
                  </label>
                )}

                <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-[#1F332B] rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0A120F] border-b border-slate-200 dark:border-[#1F332B] sticky top-0">
                      <tr>
                        <th className="p-2 text-start w-12">#</th>
                        <th className="p-2 text-start">{t.fullName}</th>
                        <th className="p-2 text-start">{t.status}</th>
                        <th className="p-2 text-start">{t.notes}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                      {validation.rows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50/60 dark:hover:bg-[#1A2C24]/40">
                          <td className="p-2 font-mono tabular-nums text-slate-500">{row.rowNumber}</td>
                          <td className="p-2">
                            <p className="font-bold truncate max-w-[200px]">{row.summaryTitle}</p>
                            <p className="text-[11px] font-mono text-slate-500 truncate max-w-[220px]">
                              {row.summaryMeta}
                            </p>
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {row.status === 'valid' && (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{t.statusValid}</span>
                              </span>
                            )}
                            {row.status === 'warning' && (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{t.statusWarning}</span>
                              </span>
                            )}
                            {row.status === 'error' && (
                              <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{t.statusError}</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-[11px] text-slate-600 dark:text-slate-300">
                            {(isAr ? row.messagesAr : row.messagesEn).join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            disabled={importableRows.length === 0}
            onClick={handleConfirmImport}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 rotate-180" />
            <span>
              {t.confirmImportRows} ({importableRows.length})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
