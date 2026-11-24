import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  Folder,
  FolderTree,
  Smartphone,
  Terminal,
} from 'lucide-react';
import appIconImg from '../assets/images/ostora_app_icon_1794578215972.jpg';
import featureGraphicImg from '../assets/images/ostora_feature_graphic_1794578215672.jpg';

interface FlutterFileEntry {
  path: string;
  content: string;
}

const FOLDER_GROUP_ORDER = [
  'lib/screens',
  'lib/models',
  'lib/services',
  'lib/l10n',
  'lib/theme',
  'lib/widgets',
  'lib',
  'android',
  'ios',
  'assets',
  'root',
] as const;

function getFolderGroup(filePath: string): string {
  if (filePath.startsWith('lib/')) {
    const parts = filePath.split('/');
    return parts.length >= 3 ? `lib/${parts[1]}` : 'lib';
  }
  if (filePath.startsWith('android/')) return 'android';
  if (filePath.startsWith('ios/')) return 'ios';
  if (filePath.startsWith('assets/')) return 'assets';
  return 'root';
}

export const FlutterStudioView: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  const [files, setFiles] = useState<FlutterFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('lib/main.dart');
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/flutter-files')
      .then((r) => r.json())
      .then((data) => {
        const list = (data.files ?? []) as FlutterFileEntry[];
        setFiles(list);
        if (list.length > 0 && !list.some((f) => f.path === 'lib/main.dart')) {
          setSelectedPath(list[0].path);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedFile = files.find((f) => f.path === selectedPath);
  const visibleFiles = useMemo(
    () => files.filter((f) => f.path.toLowerCase().includes(filter.toLowerCase())),
    [files, filter],
  );

  const groupedFiles = useMemo(() => {
    const map = new Map<string, FlutterFileEntry[]>();
    for (const f of visibleFiles) {
      const grp = getFolderGroup(f.path);
      const list = map.get(grp) ?? [];
      list.push(f);
      map.set(grp, list);
    }
    return FOLDER_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      label: g === 'root' ? 'Config & Docs' : `${g}/`,
      entries: map.get(g) ?? [],
    }));
  }, [visibleFiles]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const copyCurrent = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Release Header & Play Store Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-[#0A3D2C] text-white rounded-[20px] p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={appIconImg}
                alt="Ostora Accounting 512x512 App Icon"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl border border-[#C9A227] object-cover shrink-0"
              />
              <div>
                <h2 className="text-xl font-extrabold">
                  {isAr ? 'مشروع Flutter جاهز للنشر على Google Play (AAB)' : 'Google Play AAB-Ready Flutter Project'}
                </h2>
                <p className="text-xs text-white/75 font-mono mt-1">
                  com.ostora.accounting · v1.0.0+1 · Ostora Systems · {files.length} files
                </p>
              </div>
            </div>

            <div className="bg-black/25 rounded-xl p-4 font-mono text-xs text-emerald-100 space-y-1.5" dir="ltr">
              <div className="flex items-center justify-between gap-2 text-[#C9A227] font-bold">
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span>Build &amp; Release Commands (AGP 8.7.3 · Gradle 8.10.2 · SDK 35)</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText('flutter pub get\nflutter analyze\nflutter build appbundle --release')
                  }
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white cursor-pointer"
                >
                  Copy CLI
                </button>
              </div>
              <p>flutter pub get</p>
              <p>flutter analyze</p>
              <p>flutter build appbundle --release</p>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center gap-3">
            <a
              href="/api/download-flutter-zip"
              download="ostora_accounting_flutter_aab_ready.zip"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 font-bold text-sm hover:opacity-95 transition-opacity"
            >
              <Download className="w-4 h-4" />
              <span>
                {isAr ? 'تحميل مشروع Flutter الكامل (.zip)' : 'Download Full Flutter Project (.zip)'}
              </span>
            </a>
            <span className="text-xs text-white/75">
              {isAr
                ? 'يتضمن جميع الشاشات الـ 16 + AndroidManifest + Gradle + الأيقونات'
                : 'Includes all 16 screens, AndroidManifest, Gradle signing & adaptive icons'}
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold">
                {isAr ? 'صورة المتجر المميزة (1024 × 500)' : 'Play Store Feature Graphic (1024 × 500)'}
              </h3>
              <span className="text-xs text-slate-500 font-mono">16:9</span>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#1F332B] aspect-video">
              <img
                src={featureGraphicImg}
                alt="Google Play Feature Graphic 1024x500"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0A3D2C]/85 via-[#0A3D2C]/35 to-transparent flex flex-col justify-center p-5 text-white">
                <span className="text-xs font-bold text-[#C9A227]">OSTORA SYSTEMS</span>
                <p className="text-lg font-extrabold leading-tight mt-0.5">أسطورة المحاسبة</p>
                <p className="text-xs text-white/85">Legend of Accounting · Offline ERP</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <Smartphone className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227] shrink-0" />
            <span>
              {isAr
                ? 'صلاحيات Android 13+: INTERNET · SCOPED STORAGE · BILLING (متوافق مع Google Play)'
                : 'Android 13+ Permissions: INTERNET · SCOPED STORAGE · BILLING (Google Play compliant)'}
            </span>
          </div>
        </div>
      </div>

      {/* File Tree + Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-col h-[560px]">
          <div className="flex items-center gap-2 mb-3">
            <FolderTree className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
            <h3 className="text-sm font-extrabold">
              {isAr ? 'هيكل ملفات Flutter' : 'Flutter Project Structure'}
            </h3>
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isAr ? 'تصفية الملفات...' : 'Filter files...'}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] mb-3 outline-none focus:border-[#0A3D2C]"
            dir="ltr"
          />
          <div className="flex-1 overflow-y-auto space-y-2 pr-1" dir="ltr">
            {loading ? (
              <p className="text-xs text-slate-500 p-3">Loading Flutter project tree...</p>
            ) : groupedFiles.length === 0 ? (
              <p className="text-xs text-slate-500 p-3">No matching files.</p>
            ) : (
              groupedFiles.map(({ group, label, entries }) => {
                const isCollapsed = !filter && !!collapsedGroups[group];
                return (
                  <div key={group} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 font-mono truncate">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <Folder className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0A120F] text-[10px] font-mono text-slate-500">
                        {entries.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="pl-3 space-y-0.5 border-l border-slate-200 dark:border-[#1F332B] ml-2.5">
                        {entries.map((file) => {
                          const active = file.path === selectedPath;
                          const displayPath =
                            group === 'root' || group === 'lib'
                              ? file.path.replace(/^lib\//, '')
                              : file.path.slice(group.length + 1);
                          return (
                            <button
                              key={file.path}
                              onClick={() => setSelectedPath(file.path)}
                              title={file.path}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono truncate transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#0A3D2C] text-white font-semibold'
                                  : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24] text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {displayPath}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8 bg-[#0D1512] text-slate-100 rounded-[20px] border border-[#1F332B] flex flex-col h-[560px] overflow-hidden" dir="ltr">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F332B] bg-[#09100E]">
            <div className="flex items-center gap-2 text-xs font-mono text-[#C9A227] truncate">
              <FileCode2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{selectedPath}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!selectedFile) return;
                  const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = selectedFile.path.split('/').pop() || 'file.dart';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
              <button
                onClick={copyCurrent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 hover:opacity-95 text-xs font-bold cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-emerald-50/90">
            <code>{selectedFile?.content ?? ''}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
