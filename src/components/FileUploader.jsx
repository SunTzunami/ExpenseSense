import React, { useRef, useState } from 'react';

const FileUploader = ({ onFileUpload, onUseDemo }) => {
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileInput = async (e) => {
        if (e.target.files && e.target.files[0]) {
            setIsLoading(true);
            try {
                await onFileUpload(e.target.files[0]);
            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to parse file");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="retro-window w-[400px]">
            <div className="retro-titlebar">
                <span>Open File</span>
                <div className="retro-titlebar-buttons">
                    <div className="retro-titlebar-button">X</div>
                </div>
            </div>
            <div className="retro-content bg-[#c0c0c0] flex flex-col items-center py-6">
                
                <div className="mb-6 flex gap-4">
                    <img src="https://win98icons.alexmeub.com/icons/png/file_lines-0.png" width="32" height="32" alt="File" />
                    <div>
                        <div className="text-[13px] font-bold">Select Data File (*.xls, *.xlsx)</div>
                        <div className="text-[11px] mt-1">Please select an Excel file to begin analysis.</div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-[13px] font-bold mb-4">Loading data, please wait...</div>
                ) : (
                    <div className="flex flex-col w-full px-8 gap-4">
                        <button 
                            className="retro-button w-full justify-center"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Browse...
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileInput}
                            accept=".xls,.xlsx"
                            className="hidden"
                        />
                        
                        <div className="w-full h-px bg-[#808080] border-b border-[#ffffff] my-2"></div>
                        
                        <div className="text-[11px] text-center">No file? Try demo mode.</div>
                        <button 
                            className="retro-button w-full justify-center"
                            onClick={onUseDemo}
                        >
                            Load Demo Data
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUploader;
