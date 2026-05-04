import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, AlertCircle, CheckCircle, ShieldAlert, Loader2, Download, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

type AssessmentReport = {
  docSummary: string;
  overallComplianceScore: number;
  collectionName?: string;
  frameworkAssessments: {
    framework: string;
    complianceLevel: 'High' | 'Medium' | 'Low';
    findings: string[];
    recommendations: string[];
  }[];
  identifiedRisks: {
    riskType: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    mitigation: string;
  }[];
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AssessmentReport | null>(null);

  const [view, setView] = useState<'assessment' | 'history' | 'regulations'>('assessment');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setReport(null);
      setError(null);
      setLoadingStage('');
      setView('assessment');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1
  });

  const analyzeDocumentation = async () => {
    if (!file) return;

    setLoading(true);
    setLoadingStage('Extracting Text...');
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const timer1 = setTimeout(() => setLoadingStage('Assessing Compliance...'), 2000);
    const timer2 = setTimeout(() => setLoadingStage('Generating Report...'), 6000);

    try {
      const response = await fetch('/api/assess', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const textData = await response.text();
        if (textData.includes("Please wait while your application starts")) {
           throw new Error("The backend server is currently restarting. Please wait a few seconds and try again.");
        }
        throw new Error(`Server returned non-JSON response. Status: ${response.status}. Content type: ${contentType}. Body preview: ${textData.substring(0, 150)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze documentation');
      }

      setReport(data);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased font-sans transition-colors duration-200">
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('assessment')}>
          <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">AI Risk Compliance Tracker</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setView('regulations')} className={`text-sm font-medium ${view === 'regulations' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'} transition-colors`}>
            Regulations
          </button>
          <button onClick={() => setView('history')} className={`text-sm font-medium ${view === 'history' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'} transition-colors`}>
            Assessment History
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            Groq API Active
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-8 space-y-8 overflow-y-auto">
        {view === 'regulations' ? (
          <RegulationsView />
        ) : view === 'history' ? (
          <HistoryView onSelectReport={(rep) => { setReport(rep); setView('assessment'); }} />
        ) : (
          <>
            {!report && (
              <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Documentation Analysis Engine</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Upload model cards, technical specs, or safety documentation to evaluate compliance against major AI frameworks.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">1. Upload Documentation</h2>
              
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:bg-slate-800/50'
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
                {isDragActive ? (
                  <p className="text-blue-600 text-sm font-medium">Drop the file here ...</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Drag & drop a file here, or click to browse</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Supports PDF and TXT (Max 10MB)</p>
                  </div>
                )}
              </div>

              <div className="text-center mt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Need a file to test with?</p>
                <a 
                  href="/sample-model-card.txt" 
                  download 
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 mt-1"
                >
                  <Download className="w-3 h-3" />
                  Download Sample Model Card
                </a>
              </div>


            <AnimatePresence>
              {file && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex items-center justify-between shadow-sm mt-4"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={analyzeDocumentation}
                    disabled={loading}
                    className="ml-4 flex-shrink-0 bg-blue-600 text-white px-5 py-2 rounded-lg font-medium text-sm shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingStage || 'Analyzing...'}</span>
                      </span>
                    ) : (
                      'Run Full Analysis'
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {report && (
          <ReportDisplay report={report} onReset={() => setReport(null)} />
        )}
          </>
        )}
      </main>
    </div>
  );
}

function RegulationsView() {
  const regulations = [
    {
      id: 'eu-ai-act',
      name: 'EU AI Act',
      description: 'The European Artificial Intelligence Act is a regulation on artificial intelligence in the European Union.',
      url: 'https://artificialintelligenceact.eu/wp-content/uploads/2024/01/AI-Act-Draft-Final-Compromise-Text-January-2024.pdf'
    },
    {
      id: 'nist-ai-rmf',
      name: 'NIST AI RMF 1.0',
      description: 'NIST Artificial Intelligence Risk Management Framework (AI RMF 1.0). Provides guidance to help organizations manage risks of AI systems.',
      url: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf'
    },
    {
      id: 'gdpr',
      name: 'GDPR',
      description: 'General Data Protection Regulation (EU) 2016/679. Regulates data protection and privacy in the EU and EEA.',
      url: 'https://gdpr-info.eu/files/GDPR.pdf'
    },
    {
      id: 'ccpa',
      name: 'CPRA / CCPA',
      description: 'California Privacy Rights Act / California Consumer Privacy Act. Enhances privacy rights and consumer protection for residents of California.',
      url: 'https://theccpa.org/wp-content/uploads/2023/12/ccpa-cpra-text.pdf'
    },
    {
      id: 'iso-iec-42001',
      name: 'ISO/IEC 42001 (Overview)',
      description: 'Information technology — Artificial intelligence — Management system overview. Standards for establishing, implementing, maintaining and continually improving an AI management system.',
      url: 'https://standards.iso.org/ittf/PubliclyAvailableStandards/c081230_ISO_IEC_42001_2023(en).zip'
    },
    {
      id: 'blueprint-ai-bor',
      name: 'Blueprint for an AI Bill of Rights',
      description: 'A set of five principles and associated practices to help guide the design, use, and deployment of automated systems to protect the rights of the American public.',
      url: 'https://www.whitehouse.gov/wp-content/uploads/2022/10/Blueprint-for-an-AI-Bill-of-Rights.pdf'
    }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Governing Body Regulations</h2>
      <p className="text-slate-500 dark:text-slate-400">Download official documentation, frameworks, and regulations for AI compliance.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {regulations.map((reg) => (
          <div key={reg.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col hover:border-blue-300 transition-colors">
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50 mb-2">{reg.name}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 flex-1">{reg.description}</p>
            <a 
              href={reg.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors mt-auto"
            >
              <Download className="w-4 h-4" />
              Download Official Document
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryView({ onSelectReport }: { onSelectReport: (report: AssessmentReport) => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    fetch('/api/history')
      .then(async (res) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          return res.json();
        } else {
          throw new Error("Failed to fetch history. Server returned unexpected format.");
        }
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        setHistory(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-xl border border-red-200">
        <h3 className="text-red-800 font-bold mb-2">History Fetch Failed</h3>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="text-red-600 text-sm mt-2">Did you configure Supabase in your environment variables?</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">No Assessment History</h3>
        <p className="text-slate-500 dark:text-slate-400">You haven't run any compliance assessments yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Analysis History</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 transition-colors cursor-pointer flex flex-col" onClick={() => onSelectReport(item.report)}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate" title={item.file_name}>{item.file_name}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{item.report.docSummary}</p>
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
              <span className={`text-sm font-bold ${item.report.overallComplianceScore >= 80 ? 'text-emerald-500' : item.report.overallComplianceScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                {item.report.overallComplianceScore}/100
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportDisplay({ report, onReset }: { report: AssessmentReport; onReset: () => void }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'Critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getComplianceColor = (level: string) => {
    switch(level) {
      case 'High': return 'text-emerald-500 bg-emerald-50 border-emerald-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700';
    }
  };

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "ai-compliance-assessment.json");
    dlAnchorElem.click();
    dlAnchorElem.remove();
  };

  const downloadPdf = async () => {
    const reportElement = document.getElementById('report-content');
    if (!reportElement) return;

    try {
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add a slight padding at the top of the PDF page
      const margin = 10;
      
      pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth - (margin*2), imgHeight - (margin*2));
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position + margin, pdfWidth - (margin*2), imgHeight - (margin*2));
        heightLeft -= pdfHeight;
      }

      pdf.save('ai-compliance-assessment.pdf');
    } catch (error) {
      console.error('Failed to generate PDF', error);
      alert('Failed to generate PDF');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">Evaluation Report</h2>
        <div className="flex gap-3">
          <button onClick={downloadJson} className="px-4 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-950 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            JSON
          </button>
          <button onClick={downloadPdf} className="px-4 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-950 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button onClick={onReset} className="px-4 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-950 transition-colors">
            New Assessment
          </button>
        </div>
      </div>

      <div id="report-content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-1 md:col-span-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Executive Summary</h3>
          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{report.docSummary}</p>
        </div>
        <div className="col-span-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Compliance Score</h3>
          <div className="flex items-baseline space-x-1">
            <span className={`text-5xl font-extrabold tracking-tight ${getScoreColor(report.overallComplianceScore)}`}>
              {report.overallComplianceScore}
            </span>
            <span className="text-lg text-slate-400 dark:text-slate-500 font-medium">/100</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Risk Overview</h3>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 flex gap-4 md:gap-8 flex-wrap">
            {(['Critical', 'High', 'Medium', 'Low'] as const).map(severity => {
               const count = report.identifiedRisks.filter(r => r.severity === severity).length;
               return (
                 <div key={severity} className="flex flex-col space-y-1.5 items-start">
                   <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-200">{count}</div>
                   <div className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getSeverityBadge(severity)}`}>
                     {severity}
                   </div>
                 </div>
               );
            })}
          </div>
          
          <div className="h-32 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Critical', value: report.identifiedRisks.filter(r => r.severity === 'Critical').length, color: '#ef4444' },
                    { name: 'High', value: report.identifiedRisks.filter(r => r.severity === 'High').length, color: '#f97316' },
                    { name: 'Medium', value: report.identifiedRisks.filter(r => r.severity === 'Medium').length, color: '#eab308' },
                    { name: 'Low', value: report.identifiedRisks.filter(r => r.severity === 'Low').length, color: '#10b981' },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  dataKey="value"
                  stroke="none"
                >
                  {
                    [
                      { name: 'Critical', value: report.identifiedRisks.filter(r => r.severity === 'Critical').length, color: '#ef4444' },
                      { name: 'High', value: report.identifiedRisks.filter(r => r.severity === 'High').length, color: '#f97316' },
                      { name: 'Medium', value: report.identifiedRisks.filter(r => r.severity === 'Medium').length, color: '#eab308' },
                      { name: 'Low', value: report.identifiedRisks.filter(r => r.severity === 'Low').length, color: '#10b981' },
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))
                  }
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }} 
                  itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="md:border-l md:border-slate-100 dark:border-slate-800 md:pl-8 text-center md:text-right flex flex-col items-center md:items-end shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Total Identified Risks</h3>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{report.identifiedRisks.length}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Framework Overview</h3>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 h-64">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart
               data={report.frameworkAssessments.map(fa => ({
                 name: fa.framework,
                 score: fa.complianceLevel === 'High' ? 100 : fa.complianceLevel === 'Medium' ? 60 : 30,
                 level: fa.complianceLevel
               }))}
               margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
             >
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
               <Tooltip 
                 cursor={{ fill: '#f8fafc' }}
                 contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                 formatter={(value: number, name: string, props: any) => [props.payload.level, 'Compliance Level']}
               />
               <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={60}>
                 {
                   report.frameworkAssessments.map((fa, i) => (
                     <Cell key={`cell-${i}`} fill={fa.complianceLevel === 'High' ? '#10b981' : fa.complianceLevel === 'Medium' ? '#eab308' : '#ef4444'} />
                   ))
                 }
               </Bar>
             </BarChart>
           </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Framework Alignments</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {report.frameworkAssessments.map((fa, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{fa.framework}</h4>
                <div className={`px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getComplianceColor(fa.complianceLevel)}`}>
                  {fa.complianceLevel}
                </div>
              </div>
              <div className="p-6 space-y-5 flex-1">
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5"/> Findings</h5>
                  <ul className="space-y-2">
                    {fa.findings.map((finding, idx) => (
                      <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 mt-0.5">•</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5"/> Recommendations</h5>
                  <ul className="space-y-2">
                    {fa.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-blue-500 mt-0.5">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Identified Risks & Mitigations</h3>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <ul className="divide-y divide-slate-100">
            {report.identifiedRisks.map((risk, i) => (
              <li key={i} className="p-6 hover:bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="space-y-2 md:w-1/3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getSeverityBadge(risk.severity)}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-50 text-sm">{risk.riskType}</h4>
                  </div>
                  <div className="md:w-2/3 space-y-4">
                    <div>
                      <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Risk Description</h5>
                      <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">{risk.description}</p>
                    </div>
                    <div>
                      <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Mitigation Strategy</h5>
                      <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-700">{risk.mitigation}</p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {report.identifiedRisks.length === 0 && (
              <li className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                No high priority risks identified in the documentation.
              </li>
            )}
          </ul>
        </div>
      </div>
      </div>

      {report.collectionName && (
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700 mt-8">
          <ChatAssistant collectionName={report.collectionName} />
        </div>
      )}
    </motion.div>
  );
}

function ChatAssistant({ collectionName }: { collectionName: string }) {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([{
     role: 'assistant', content: "Hello! I'm your AI Compliance Assistant. I can answer questions about the document you just uploaded. What would you like to know?"
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, collectionName })
      });
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text.includes("Please wait while your application starts")) {
           throw new Error("The backend server is currently restarting. Please wait a few seconds and try again.");
        }
        throw new Error("Server returned unexpected format.");
      }
      
      if (!response.ok) throw new Error(data.error || 'Failed to chat');
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[500px]">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Document Q&A Assistant</h3>
        <span className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>Vector RAG
        </span>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-bl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-bl-none flex items-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question about the document..."
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
