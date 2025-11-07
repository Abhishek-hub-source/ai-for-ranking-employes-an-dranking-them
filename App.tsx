import React, { useState, useCallback, useMemo } from 'react';
import type { AnalyzedEmployee, RankedEmployee, TaskAssignment } from './types';
import { analyzeResumeFromPdfImages, rankEmployees, distributeTasks } from './services/geminiService';
import { UserPlusIcon, BrainCircuitIcon, ClipboardListIcon, WandIcon, DocumentArrowUpIcon, SparklesIcon } from './components/icons';

// --- Helper Components defined outside App ---

const Header: React.FC = () => (
    <header className="bg-slate-900/50 backdrop-blur-lg p-4 sticky top-0 z-10 border-b border-slate-700/50 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <BrainCircuitIcon className="w-8 h-8 text-violet-400" />
                <h1 className="text-2xl font-bold text-white tracking-wider" style={{ textShadow: '0 0 8px rgba(167, 139, 250, 0.5)' }}>AI Employee Sorter</h1>
            </div>
        </div>
    </header>
);

const processPdfToImages = async (file: File): Promise<{ mimeType: string, data: string }[]> => {
    if (!window.pdfjsLib) {
        throw new Error("PDF processing library is not loaded. Please wait a moment and try again.");
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.102/build/pdf.worker.min.js`;

    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            try {
                if (!event.target?.result) return reject(new Error("Failed to read file"));
                
                const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
                const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
                const images: { mimeType: string, data: string }[] = [];
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (!context) {
                        throw new Error('Could not get canvas context');
                    }

                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    
                    const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
                    images.push({ mimeType: 'image/jpeg', data: base64Data });
                }
                resolve(images);
            } catch (error) {
                console.error("Error processing PDF:", error);
                if (error && typeof error === 'object' && 'name' in error && error.name === 'PasswordException') {
                    reject(new Error("The PDF file is password-protected. Please provide a decrypted file."));
                } else {
                    reject(new Error("Failed to process the PDF file. It might be corrupted or in an unsupported format."));
                }
            }
        };
        fileReader.onerror = () => reject(new Error("An error occurred while reading the file."));
        fileReader.readAsArrayBuffer(file);
    });
};

interface EmployeeFormProps {
    onAddEmployee: (employee: AnalyzedEmployee) => void;
    onError: (message: string) => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onAddEmployee, onError }) => {
    const [name, setName] = useState('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if(e.target.files[0].type === 'application/pdf') {
                setResumeFile(e.target.files[0]);
                 onError('');
            } else {
                onError("Please upload a valid PDF file.");
                setResumeFile(null);
                e.target.value = '';
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && resumeFile) {
            setIsAnalyzing(true);
            onError('');
            try {
                const pdfImages = await processPdfToImages(resumeFile);
                const analysisResult = await analyzeResumeFromPdfImages(pdfImages);
                onAddEmployee({
                    id: crypto.randomUUID(),
                    name,
                    ...analysisResult,
                });
                setName('');
                setResumeFile(null);
                const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } catch (err) {
                console.error(err);
                onError(err instanceof Error ? err.message : "Failed to analyze resume.");
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    return (
        <div className="panel-3d aurora-border p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-violet-300">
                <UserPlusIcon className="w-6 h-6" />
                Add New Employee
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Employee Name"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-md p-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition placeholder-slate-400"
                    disabled={isAnalyzing}
                />
                
                <label htmlFor="resume-upload" className="cursor-pointer w-full flex items-center justify-center gap-3 bg-slate-900/50 border border-slate-700 rounded-md p-3 text-slate-400 hover:border-violet-500 hover:text-slate-200 transition">
                    <DocumentArrowUpIcon className="w-6 h-6" />
                    <span>{resumeFile ? resumeFile.name : 'Upload Resume (PDF)'}</span>
                </label>
                <input
                    id="resume-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isAnalyzing}
                />

                <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg hover:shadow-violet-500/30 active:scale-[0.98]"
                    disabled={!name.trim() || !resumeFile || isAnalyzing}
                >
                    {isAnalyzing ? (
                        <>
                            <SparklesIcon className="w-5 h-5 animate-pulse" />
                            Analyzing Resume...
                        </>
                    ) : (
                        'Add & Analyze Employee'
                    )}
                </button>
            </form>
        </div>
    );
};


interface EmployeeListProps {
    employees: (AnalyzedEmployee | RankedEmployee)[];
    onRank: () => void;
    isRanking: boolean;
    isRanked: boolean;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onRank, isRanking, isRanked }) => (
    <div className="panel-3d aurora-border p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-violet-300">Employee Roster</h2>
            <button
                onClick={onRank}
                disabled={employees.length === 0 || isRanking}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98]"
            >
                {isRanking ? 'Analyzing...' : (isRanked ? 'Re-Analyze Ranks' : 'Analyze & Rank All')}
            </button>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
            {employees.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Add employees via PDF to get started.</p>
            ) : (
                employees.map((emp, index) => (
                    <div key={emp.id} className="bg-slate-900/60 p-4 rounded-lg border border-slate-700/80 animate-fade-in transition-transform duration-300 hover:scale-[1.02] hover:border-violet-500/50" style={{ animationDelay: `${index * 70}ms` }}>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-baseline gap-3 flex-wrap">
                                    <h3 className="font-bold text-lg text-slate-100">{emp.name}</h3>
                                    <span className="text-sm font-medium bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{emp.experienceYears} yrs exp</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2 italic">
                                    "{'rank' in emp ? (emp as RankedEmployee).justification : emp.summary}"
                                </p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {emp.skills.map(skill => (
                                        <span key={skill} className="bg-violet-500/20 text-violet-300 text-xs font-medium px-2.5 py-1 rounded-full">{skill}</span>
                                    ))}
                                </div>
                            </div>
                            {'rank' in emp && (
                                <div className="text-3xl font-bold text-violet-400 ml-4 whitespace-nowrap" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.6)' }}>
                                    #{(emp as RankedEmployee).rank}
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
);


interface TaskPanelProps {
    rankedEmployees: RankedEmployee[];
    onDistribute: (tasks: string) => void;
    assignments: TaskAssignment[];
    isDistributing: boolean;
}

const TaskPanel: React.FC<TaskPanelProps> = ({ rankedEmployees, onDistribute, assignments, isDistributing }) => {
    const [tasks, setTasks] = useState('');

    const employeeMap = useMemo(() => 
        new Map(rankedEmployees.map(emp => [emp.id, emp.name])),
        [rankedEmployees]
    );

    const handleDistribute = () => {
        if (tasks.trim()) {
            onDistribute(tasks);
        }
    };

    return (
        <div className="panel-3d aurora-border p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-teal-300">
                <ClipboardListIcon className="w-6 h-6" />
                Daily Task Distribution
            </h2>
            <textarea
                value={tasks}
                onChange={(e) => setTasks(e.target.value)}
                placeholder="Enter daily tasks, one per line..."
                rows={6}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-md p-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition placeholder-slate-400"
                disabled={rankedEmployees.length === 0}
            />
            <button
                onClick={handleDistribute}
                disabled={rankedEmployees.length === 0 || !tasks.trim() || isDistributing}
                className="w-full mt-4 flex justify-center items-center gap-2 bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg hover:shadow-teal-500/30 active:scale-[0.98]"
            >
                <WandIcon className="w-5 h-5"/>
                {isDistributing ? 'Assigning...' : 'Distribute Tasks with AI'}
            </button>
            {assignments.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3 text-teal-300">Task Assignments</h3>
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 -mr-2">
                        {assignments.map((assignment, index) => (
                             <div key={assignment.employeeId} className="bg-slate-900/60 p-4 rounded-lg border border-slate-700/80 animate-fade-in" style={{ animationDelay: `${index * 70}ms` }}>
                                <h4 className="font-bold text-md text-teal-300">{employeeMap.get(assignment.employeeId) || 'Unknown Employee'}</h4>
                                <ul className="list-disc list-inside mt-2 text-slate-300 space-y-1">
                                    {assignment.tasks.map(task => <li key={task}>{task}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [employees, setEmployees] = useState<AnalyzedEmployee[]>([]);
    const [rankedEmployees, setRankedEmployees] = useState<RankedEmployee[]>([]);
    const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
    const [isRanking, setIsRanking] = useState(false);
    const [isDistributing, setIsDistributing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isRanked = rankedEmployees.length > 0;
    
    const handleSetError = (message: string) => {
        setError(message);
        setTimeout(() => setError(null), 7000);
    };

    const handleAddEmployee = useCallback((employee: AnalyzedEmployee) => {
        setEmployees(prev => [...prev, employee]);
        setRankedEmployees([]);
        setAssignments([]);
    }, []);

    const handleRankEmployees = useCallback(async () => {
        if (employees.length === 0) return;
        setIsRanking(true);
        setError(null);
        try {
            const result = await rankEmployees(employees);
            setRankedEmployees(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during ranking.');
        } finally {
            setIsRanking(false);
        }
    }, [employees]);

    const handleDistributeTasks = useCallback(async (tasksText: string) => {
        if (rankedEmployees.length === 0) return;
        const tasks = tasksText.split('\n').filter(t => t.trim() !== '');
        if (tasks.length === 0) return;

        setIsDistributing(true);
        setError(null);
        try {
            const result = await distributeTasks(rankedEmployees, tasks);
            setAssignments(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during task distribution.');
        } finally {
            setIsDistributing(false);
        }
    }, [rankedEmployees]);
    
    const displayEmployees = isRanked ? rankedEmployees.sort((a,b) => b.rank - a.rank) : employees;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
            <Header />
            <main className="container mx-auto p-4 md:p-8">
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-xl mb-6 shadow-lg animate-fade-in" role="alert">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold">Error</p>
                                <p>{error}</p>
                            </div>
                            <button onClick={() => setError(null)} className="text-red-300 hover:text-white">&times;</button>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 [perspective:2000px]">
                    <div className="space-y-8 animate-fade-in" style={{animationDelay: '100ms'}}>
                        <EmployeeForm onAddEmployee={handleAddEmployee} onError={handleSetError} />
                        <EmployeeList 
                            employees={displayEmployees}
                            onRank={handleRankEmployees}
                            isRanking={isRanking}
                            isRanked={isRanked}
                        />
                    </div>
                    <div className="space-y-8 animate-fade-in" style={{animationDelay: '200ms'}}>
                        <TaskPanel 
                            rankedEmployees={rankedEmployees} 
                            onDistribute={handleDistributeTasks}
                            assignments={assignments}
                            isDistributing={isDistributing}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;