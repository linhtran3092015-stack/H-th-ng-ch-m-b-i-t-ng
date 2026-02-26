
import React, { useState, useRef, useMemo } from 'react';
import { ClassData, GradingResult, GradingReport } from './types';
import { processClassGrading } from './services/geminiService';
import * as XLSX from 'xlsx';
import { 
  Sparkles,
  Play,
  Video,
  MessageSquareHeart,
  Loader2,
  Copy,
  Check,
  Link as LinkIcon,
  RefreshCw,
  Image as ImageIcon,
  Download,
  SortAsc,
  SortDesc,
  UserCheck,
  GraduationCap,
  Trophy,
  Award,
  Medal,
  Frown,
  Clock,
  Target,
  Zap,
  Star,
  Quote,
  ChevronRight,
  PlusCircle,
  FileText,
  Trash2,
  VideoOff,
  ShieldCheck,
  BookOpenCheck,
  BrainCircuit,
  AlertTriangle,
  FileSearch,
  ExternalLink,
  ClipboardList
} from 'lucide-react';

type SortKey = 'name' | 'score' | 'time';
type SortOrder = 'asc' | 'desc';

const FEEDBACK_META = [
  { label: 'KẾT QUẢ', icon: <Target className="w-3.5 h-3.5" />, color: 'bg-blue-500', text: 'text-blue-600', ring: 'ring-blue-100' },
  { label: 'HÀNH ĐỘNG', icon: <Zap className="w-3.5 h-3.5" />, color: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-100' },
  { label: 'CAMERA', icon: <Video className="w-3.5 h-3.5" />, color: 'bg-purple-500', text: 'text-purple-600', ring: 'ring-purple-100' },
  { label: 'TƯƠNG TÁC', icon: <MessageSquareHeart className="w-3.5 h-3.5" />, color: 'bg-rose-500', text: 'text-rose-600', ring: 'ring-rose-100' },
  { label: 'LỜI CHÚC', icon: <Star className="w-3.5 h-3.5" />, color: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-100' },
];

const App: React.FC = () => {
  const [classData, setClassData] = useState<ClassData>({
    markingGuide: '',
    sheetUrl: '',
    sheetData: '',
    camVisibleList: '',
    camHiddenList: '',
    praiseList: ''
  });
  
  const [results, setResults] = useState<GradingResult[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [answerKey, setAnswerKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') comp = a.firstName.localeCompare(b.firstName, 'vi');
      else if (sortBy === 'score') comp = a.score - b.score;
      else if (sortBy === 'time') comp = a.submissionTime.localeCompare(b.submissionTime);
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [results, sortBy, sortOrder]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setClassData(prev => ({ ...prev, testImage: event.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const fetchSheetData = async () => {
    if (!classData.sheetUrl) return;
    setIsFetching(true);
    try {
      const convertToCsvUrl = (url: string) => {
        if (url.includes('/pubhtml')) return url.replace('/pubhtml', '/pub?output=csv');
        return url.includes('?') ? `${url}&output=csv` : `${url}?output=csv`;
      };
      const response = await fetch(convertToCsvUrl(classData.sheetUrl));
      if (!response.ok) throw new Error("Lỗi tải.");
      const text = await response.text();
      setClassData(prev => ({ ...prev, sheetData: text }));
    } catch (err) {
      alert("Không thể tải dữ liệu tự động. Hãy dán thủ công nội dung từ Sheet.");
    } finally { setIsFetching(false); }
  };

  const startGrading = async () => {
    if (!classData.sheetData || !classData.testImage) {
      alert("Vui lòng tải ảnh đề bài và dán dữ liệu Sheet học sinh.");
      return;
    }
    setIsProcessing(true);
    setValidationWarnings([]);
    
    const statuses = [
      'Đang nhận diện cấu trúc TSV/Tab...',
      'Đang ánh xạ cột dữ liệu học sinh...',
      'Đang tái cấu trúc bài làm viết tay...',
      'Đang nháp ngầm & Tính toán lại...',
      'Đang rà soát sai sót & Đối chiếu...',
      'Đang hoàn thiện nhận xét cá nhân hóa...'
    ];
    let sIdx = 0;
    const interval = setInterval(() => {
      setProcessingStatus(statuses[sIdx % statuses.length]);
      sIdx++;
    }, 3000);
    
    try {
      const report = await processClassGrading(classData);
      setResults(report.results);
      setAnswerKey(report.answerKey);
      if (report.validationWarnings) {
        setValidationWarnings(report.validationWarnings);
      }
    } catch (error: any) {
      console.error(error);
      alert("Có lỗi xảy ra trong quá trình chấm bài. Vui lòng thử lại.");
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  };

  const exportToExcel = () => {
    if (sortedResults.length === 0) return;
    
    // Prepare the data for Excel
    const data = sortedResults.map((r, i) => ({
      'STT': i + 1,
      'Họ tên': r.studentName,
      'Bài làm': r.studentAnswer,
      'Thời gian': r.submissionTime,
      'Xếp hạng': r.rank,
      'Điểm': r.score,
      'Nhận xét': r.feedback.join('\n')
    }));

    // Create a new worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết quả chấm bài");

    // Adjust column widths for better visual experience
    const wscols = [
      { wch: 6 },   // STT
      { wch: 30 },  // Họ tên
      { wch: 50 },  // Bài làm
      { wch: 15 },  // Thời gian
      { wch: 15 },  // Xếp hạng
      { wch: 10 },  // Điểm
      { wch: 100 }  // Nhận xét
    ];
    worksheet['!cols'] = wscols;

    // Generate and download the file
    XLSX.writeFile(workbook, `KetQua_ThayVinh_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const getRankStyle = (rank: string) => {
    switch(rank) {
      case 'Nhất': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Trophy className="w-4 h-4" />, glow: 'shadow-amber-100' };
      case 'Nhì': return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: <Award className="w-4 h-4" />, glow: 'shadow-slate-100' };
      case 'Ba': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: <Medal className="w-4 h-4" />, glow: 'shadow-orange-100' };
      case 'Khuyến khích': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Sparkles className="w-4 h-4" />, glow: 'shadow-emerald-100' };
      case 'Không đạt': return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: <Frown className="w-4 h-4" />, glow: 'shadow-rose-100' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: <Target className="w-4 h-4" />, glow: 'shadow-slate-100' };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 pb-24 transition-all">
      {/* Header Navigation */}
      <nav className="bg-white/95 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 shadow-sm transition-all">
        <div className="max-w-[1440px] mx-auto px-4 md:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 ring-2 md:ring-4 ring-indigo-50">
              <GraduationCap className="w-5 h-5 md:w-7 md:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black tracking-tight text-slate-900 uppercase leading-none">Vinh<span className="text-indigo-600">Grading</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <a href="#" className="hover:text-indigo-600 transition-colors">Hướng dẫn</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Mẫu Sheet</a>
            </div>
            <button 
              disabled={isProcessing}
              onClick={startGrading}
              className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-2xl transition-all active:scale-95 group ${isProcessing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 md:hover:-translate-y-0.5'}`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  <span className="animate-pulse hidden sm:inline">{processingStatus}</span>
                  <span className="animate-pulse sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current group-hover:scale-110 transition-transform" /> <span className="hidden sm:inline">Bắt đầu chấm bài</span><span className="sm:hidden">Chấm bài</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-4 md:px-10 py-6 md:py-12">
        {/* Deep Thinking Header Banner */}
        {isProcessing && (
          <div className="mb-6 md:mb-12 bg-indigo-600 rounded-2xl md:rounded-[40px] p-5 md:p-8 shadow-2xl shadow-indigo-200 animate-in fade-in zoom-in duration-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-white relative z-10">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-2xl md:rounded-[32px] flex items-center justify-center backdrop-blur-md shadow-xl border border-white/20 shrink-0">
                <BrainCircuit className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-lg md:text-2xl font-black tracking-tight uppercase">Rà soát chuyên sâu</h3>
                <p className="text-xs md:text-sm font-bold text-indigo-100 mt-1 md:mt-2 max-w-2xl opacity-90 leading-relaxed">
                  Đang tái cấu trúc dữ liệu TSV, kiểm tra logic các bước làm và đối chiếu sai số. Hệ thống đảm bảo kết quả chính xác tuyệt đối.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Validation Warnings Alert */}
        {validationWarnings.length > 0 && (
          <div className="mb-6 md:mb-12 bg-amber-50 border-2 border-amber-200 rounded-2xl md:rounded-[40px] p-5 md:p-8 shadow-sm animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="bg-amber-100 p-2.5 md:p-3.5 rounded-xl shadow-sm border border-amber-200/50">
                <AlertTriangle className="w-5 h-5 md:w-7 md:h-7 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm md:text-lg font-black text-amber-900 uppercase tracking-wider">Cảnh báo dữ liệu</h3>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {validationWarnings.map((warn, i) => (
                    <div key={i} className="bg-white/60 p-2 rounded-lg text-[10px] md:text-xs text-amber-800 font-bold border border-amber-100 flex items-center gap-2">
                      <span className="w-4 h-4 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center text-[8px] shrink-0">{i+1}</span>
                      {warn}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12">
          {/* Left Panel: Inputs */}
          <div className="lg:col-span-4 space-y-6 md:space-y-10">
            {/* Step 1: Handwriting Upload */}
            <div className="bg-white rounded-2xl md:rounded-[44px] shadow-sm border border-slate-200 p-6 md:p-8 transition-all hover:shadow-xl hover:shadow-slate-100">
              <h2 className="text-[10px] md:text-[12px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 md:mb-6 flex items-center gap-3">
                <span className="w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] md:text-[11px]">01</span>
                Đề bài viết tay
              </h2>
              {!classData.testImage ? (
                <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-2xl md:rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group relative overflow-hidden bg-slate-50/50">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-all">
                    <ImageIcon className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
                  </div>
                  <span className="text-xs md:text-sm font-black text-slate-500 tracking-tight">Tải ảnh đề bài lên</span>
                </div>
              ) : (
                <div className="relative rounded-2xl md:rounded-[32px] overflow-hidden group border-2 md:border-4 border-white shadow-xl aspect-video">
                  <img src={classData.testImage} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button onClick={() => setClassData({...classData, testImage: undefined})} className="bg-white text-rose-500 p-3 md:p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all">
                      <Trash2 className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-6 md:mt-8 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                  <ClipboardList className="w-3 h-3" /> Biểu mẫu chấm
                </label>
                <textarea 
                  className="w-full h-24 md:h-32 p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[28px] text-[12px] md:text-[13px] font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all resize-none shadow-inner" 
                  placeholder="Ví dụ: Câu 1 (5đ), Câu 2 (5đ)..." 
                  value={classData.markingGuide} 
                  onChange={e => setClassData({...classData, markingGuide: e.target.value})} 
                />
              </div>
            </div>

            {/* Step 2: Class Status */}
            <div className="bg-white rounded-2xl md:rounded-[44px] shadow-sm border border-slate-200 p-6 md:p-8 space-y-6 md:space-y-8 transition-all hover:shadow-xl hover:shadow-slate-100">
              <h2 className="text-[10px] md:text-[12px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 flex items-center gap-3">
                <span className="w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] md:text-[11px]">02</span>
                Giám sát lớp học
              </h2>
              <div className="space-y-4 md:space-y-6">
                <div className="group">
                  <span className="text-[10px] font-black text-emerald-600 uppercase mb-2 flex items-center gap-2 pl-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Cam Bật (Rõ)
                  </span>
                  <textarea placeholder="Danh sách học sinh..." value={classData.camVisibleList} onChange={e => setClassData({...classData, camVisibleList: e.target.value})} className="w-full h-16 md:h-20 p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl md:rounded-[24px] text-[11px] md:text-[12px] font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all resize-none" />
                </div>
                <div className="group">
                  <span className="text-[10px] font-black text-rose-500 uppercase mb-2 flex items-center gap-2 pl-2">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div> Cam Tắt
                  </span>
                  <textarea placeholder="Danh sách học sinh..." value={classData.camHiddenList} onChange={e => setClassData({...classData, camHiddenList: e.target.value})} className="w-full h-16 md:h-20 p-4 bg-rose-50/30 border border-rose-100 rounded-xl md:rounded-[24px] text-[11px] md:text-[12px] font-bold outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 transition-all resize-none" />
                </div>
                <div className="group">
                  <span className="text-[10px] font-black text-amber-500 uppercase mb-2 flex items-center gap-2 pl-2">
                    <Star className="w-3 h-3 fill-current" /> Thưởng (+1đ)
                  </span>
                  <textarea placeholder="Học sinh hăng hái..." value={classData.praiseList} onChange={e => setClassData({...classData, praiseList: e.target.value})} className="w-full h-16 md:h-20 p-4 bg-amber-50/30 border border-amber-100 rounded-xl md:rounded-[24px] text-[11px] md:text-[12px] font-bold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 transition-all resize-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-8 space-y-6 md:space-y-12">
            {/* Step 3: Student Data */}
            <div className="bg-white rounded-2xl md:rounded-[44px] shadow-sm border border-slate-200 p-6 md:p-8 transition-all hover:shadow-xl hover:shadow-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-[10px] md:text-[12px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-3">
                  <span className="w-6 h-6 md:w-7 md:h-7 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] md:text-[11px]">03</span>
                  Dữ liệu bài làm
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-initial group">
                    <LinkIcon className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-3 md:w-4 h-3 md:h-4 text-slate-400" />
                    <input type="text" placeholder="Link Google Sheet..." value={classData.sheetUrl} onChange={e => setClassData({...classData, sheetUrl: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg md:rounded-[20px] pl-9 md:pl-11 pr-4 md:pr-5 py-2 md:py-3 text-[11px] md:text-[13px] font-bold w-full sm:w-60 lg:w-72 outline-none focus:border-indigo-500 transition-all" />
                  </div>
                  <button onClick={fetchSheetData} disabled={isFetching || !classData.sheetUrl} className="p-2.5 md:p-3.5 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-[20px] hover:bg-indigo-100 disabled:opacity-50 transition-all border border-indigo-100">
                    {isFetching ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />}
                  </button>
                </div>
              </div>
              <textarea placeholder="Dán nội dung từ Google Sheet tại đây..." value={classData.sheetData} onChange={e => setClassData({...classData, sheetData: e.target.value})} className="w-full h-32 md:h-52 p-4 md:p-6 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[40px] text-[11px] md:text-[13px] font-mono font-bold outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" />
            </div>

            {results.length > 0 && (
              <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {/* Answer Key Display */}
                {answerKey && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl md:rounded-[44px] p-6 md:p-10 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 md:opacity-10 group-hover:opacity-20 transition-opacity">
                      <BookOpenCheck className="w-24 md:w-32 h-24 md:h-32 text-indigo-900" />
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 relative z-10">
                      <div className="bg-indigo-600 text-white p-2 md:p-3 rounded-lg md:rounded-2xl shadow-lg ring-2 md:ring-4 ring-indigo-100">
                        <BookOpenCheck className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm md:text-lg font-black text-indigo-900 uppercase tracking-widest leading-none">Đáp án AI</h3>
                        <p className="text-[9px] md:text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1">Đối chiếu logic</p>
                      </div>
                    </div>
                    <div className="bg-white/70 backdrop-blur-md rounded-xl md:rounded-[32px] p-4 md:p-8 border border-indigo-100 shadow-inner relative z-10">
                      <p className="text-[12px] md:text-[14px] text-indigo-800 font-mono font-bold leading-relaxed whitespace-pre-wrap">{answerKey}</p>
                    </div>
                  </div>
                )}

                {/* Sorting and Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8 sticky top-[80px] bg-[#F8FAFC]/95 backdrop-blur-md z-40 py-4 md:py-6 border-b border-slate-200">
                  <div className="flex items-center gap-3 md:gap-5">
                    <div className="bg-indigo-600 text-white p-2 md:p-3 rounded-lg md:rounded-2xl shadow-xl shadow-indigo-200">
                      <FileSearch className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Kết quả rà soát</h3>
                      <div className="flex items-center gap-3 md:gap-5 mt-1.5 md:mt-2">
                        <span className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <PlusCircle className="w-3.5 h-3.5" /> {results.length} HS
                        </span>
                        <div className="flex items-center gap-1.5 md:gap-2.5 bg-white border border-slate-200 rounded-full px-3 md:px-4 py-1 md:py-1.5 shadow-sm">
                          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 bg-transparent outline-none cursor-pointer">
                            <option value="name">Tên</option>
                            <option value="score">Điểm</option>
                            <option value="time">Giờ nộp</option>
                          </select>
                          <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-0.5 hover:bg-slate-50 rounded text-slate-400 transition-colors">
                            {sortOrder === 'asc' ? <SortAsc className="w-3 h-3 md:w-4 md:h-4" /> : <SortDesc className="w-3 h-3 md:w-4 md:h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={exportToExcel} className="flex items-center justify-center gap-3 bg-emerald-600 text-white px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-xl hover:-translate-y-0.5 active:scale-95 group">
                    <Download className="w-4 h-4 md:w-5 md:h-5" /> <span>Xuất Excel</span>
                  </button>
                </div>

                {/* Individual Cards */}
                <div className="grid grid-cols-1 gap-6 md:gap-12">
                  {sortedResults.map((res, idx) => {
                    const style = getRankStyle(res.rank);
                    const isPraised = classData.praiseList.toLowerCase().includes(res.studentName.toLowerCase()) || 
                                     classData.praiseList.toLowerCase().includes(res.firstName.toLowerCase());

                    return (
                      <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl md:rounded-[56px] p-6 md:p-12 shadow-sm hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.04)] md:hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] transition-all group relative overflow-hidden">
                        {/* Status Bar */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 md:h-2.5 ${isPraised ? 'bg-amber-400 animate-pulse' : 'bg-transparent'}`}></div>
                        
                        {/* Header Info */}
                        <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-10 mb-8 md:mb-12 relative z-10">
                          <div className="flex items-center gap-4 md:gap-8">
                            <div className="w-12 h-12 md:w-20 md:h-20 bg-slate-50 rounded-xl md:rounded-[28px] flex items-center justify-center text-lg md:text-2xl font-black text-slate-300 border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner group-hover:scale-110">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center flex-wrap gap-2 md:gap-4">
                                <h4 className="text-xl md:text-3xl font-black text-slate-900 leading-none tracking-tight">{res.studentName}</h4>
                                {isPraised && <div className="bg-amber-100 text-amber-700 text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5 md:px-3 md:py-1 rounded-full border-2 border-amber-200">Bonus (+1)</div>}
                              </div>
                              <div className="flex items-center gap-3 md:gap-5 mt-2 md:mt-4 text-slate-400">
                                <div className="flex items-center gap-1.5 md:gap-2">
                                  <Clock className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-[9px] md:text-[11px] font-black uppercase tracking-widest">{res.submissionTime}</span>
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-2">
                                  <UserCheck className="w-3 h-3 md:w-4 md:h-4 text-indigo-400" />
                                  <span className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-indigo-600">Audit OK</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10">
                            <div className={`flex items-center gap-2 md:gap-3 px-3 md:px-6 py-1.5 md:py-2.5 rounded-lg md:rounded-2xl border-2 shadow-sm ${style.bg} ${style.text} ${style.border}`}>
                              <div className="scale-100 md:scale-125">{style.icon}</div>
                              <span className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em]">{res.rank}</span>
                            </div>
                            <div className="text-right">
                              <div className="flex items-baseline gap-1 md:gap-1.5 justify-end">
                                <span className="text-4xl md:text-7xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">{res.score}</span>
                                <span className="text-sm md:text-xl font-black text-slate-300">/10</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Content Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 bg-slate-50/70 rounded-2xl md:rounded-[48px] p-5 md:p-10 border border-slate-200/50 shadow-inner">
                          {/* Raw Submission */}
                          <div className="md:col-span-4 space-y-4 md:space-y-6">
                            <h5 className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 pl-2">
                              <Quote className="w-4 h-4 md:w-5 md:h-5 text-slate-300" /> Bài làm
                            </h5>
                            <div className="bg-white rounded-2xl md:rounded-[32px] p-5 md:p-8 border-2 border-slate-100 shadow-sm min-h-[120px] md:min-h-[200px] flex items-center justify-center relative transition-all hover:border-indigo-200">
                              <p className="text-[12px] md:text-[14px] text-slate-600 font-bold italic leading-relaxed text-center whitespace-pre-wrap">"{res.studentAnswer}"</p>
                            </div>
                          </div>

                          {/* Professional Feedback */}
                          <div className="md:col-span-8">
                            <h5 className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 mb-6 md:mb-10 pl-2">
                              <BrainCircuit className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" /> Nhận xét từ Thầy Vinh
                            </h5>
                            <div className="relative space-y-6 md:space-y-10 pl-4 md:pl-8">
                              <div className="absolute left-[23px] md:left-[47px] top-6 bottom-6 w-1 md:w-1.5 bg-slate-200 rounded-full"></div>
                              {res.feedback.map((line, lIdx) => {
                                const meta = FEEDBACK_META[lIdx] || { label: 'GHI CHÚ', icon: <ChevronRight />, color: 'bg-slate-400', text: 'text-slate-400', ring: 'ring-slate-100' };
                                return (
                                  <div key={lIdx} className="relative pl-10 md:pl-16 group/line">
                                    <div className={`absolute left-0 top-0 w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl border-4 md:border-[6px] border-white shadow-xl flex items-center justify-center z-10 ${meta.color} text-white ring-4 md:ring-8 ${meta.ring}`}>
                                      {meta.icon}
                                    </div>
                                    <div className="space-y-1.5 md:space-y-2">
                                      <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest ${meta.text} flex items-center gap-1.5 md:gap-2.5`}>
                                        {meta.label} 
                                      </span>
                                      <div className="bg-white p-3 md:p-5 rounded-xl md:rounded-[24px] shadow-sm border border-slate-100 border-l-4 border-l-slate-200">
                                        <p className="text-[13px] md:text-[15px] text-slate-700 leading-relaxed font-bold">
                                          {line}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Action */}
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-8 gap-4">
                           <div className="flex items-center gap-3 md:gap-5 text-slate-400">
                             <div className="flex items-center gap-1.5 md:gap-2.5 text-[9px] md:text-[11px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-emerald-100">
                               <ShieldCheck className="w-3.5 h-3.5" /> TSV Verified
                             </div>
                           </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(res.feedback.join('\n'));
                              setCopiedIndex(idx);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 md:px-12 py-3.5 md:py-5 rounded-xl md:rounded-[24px] text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${copiedIndex === idx ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-slate-700 border-2 border-slate-200'}`}
                          >
                            {copiedIndex === idx ? <><Check className="w-4 h-4 md:w-5 md:h-5" /> Đã chép</> : <><Copy className="w-4 h-4 md:w-5 md:h-5" /> Sao chép</>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 py-3 md:py-4 px-4 md:px-12 z-50">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
          <div className="flex items-center gap-4 md:gap-8">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> 
              <span className="hidden sm:inline">System v3.7 Active</span>
              <span className="sm:hidden">v3.7 Active</span>
            </span>
            <span className="text-slate-200">|</span>
          </div>
          <p className="text-right">© 2026 THẦY VINH MATH</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
