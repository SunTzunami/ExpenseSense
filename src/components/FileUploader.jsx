
import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FileUploader = ({ onFileUpload, onUseDemo }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const processFile = async (file) => {
        setIsLoading(true);
        // Simulate slight delay for UI feedback or actual processing time
        try {
            await onFileUpload(file);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to parse file");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-20 p-8 glass-panel text-center">
            <motion.div
                className={`border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer
            ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'}
        `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept=".xls,.xlsx"
                    className="hidden"
                />

                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key="loading"
                            className="flex flex-col items-center"
                        >
                            <Loader2 className="animate-spin text-primary mb-4" size={48} />
                            <h3 className="text-xl font-semibold mb-2">Processing Data...</h3>
                            <p className="text-gray-400">Analyzing thousands of rows locally</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key="upload"
                            className="flex flex-col items-center"
                        >
                            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                                <FileSpreadsheet className="text-primary" size={36} />
                            </div>

                            <h2 className="text-2xl font-bold mb-3">Upload Expense Data</h2>
                            <p className="text-gray-400 mb-6 max-w-sm">
                                Drag and drop your Excel file here, or click to browse.
                                <br /><span className="text-xs opacity-60">Supports .xls and .xlsx</span>
                            </p>

                            <button className="glass-button px-8 py-3 flex items-center gap-2">
                                <Upload size={18} />
                                Select File
                            </button>

                            <div className="mt-8 pt-6 border-t border-gray-700/50 w-full max-w-xs mx-auto">
                                <p className="text-sm text-gray-500 mb-3">Just want to look around?</p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUseDemo(); }}
                                    className="text-xs px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-white/5"
                                >
                                    Try with Demo Data
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default FileUploader;
