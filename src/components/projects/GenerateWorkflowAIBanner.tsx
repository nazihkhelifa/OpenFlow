"use client";

import { useState } from "react";
import type { WorkflowFile } from "@/store/workflowStore";
import { PromptWorkflowView } from "@/components/quickstart/PromptWorkflowView";

type GenerateWorkflowAIBannerProps = {
  onWorkflowSelected: (workflow: WorkflowFile) => void;
};

export function GenerateWorkflowAIBanner({ onWorkflowSelected }: GenerateWorkflowAIBannerProps) {
  const [showAIPrompt, setShowAIPrompt] = useState(false);

  return (
    <>
      {showAIPrompt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAIPrompt(false)}
        >
          <div
            className="w-full max-w-2xl mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl overflow-clip max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <PromptWorkflowView
              onBack={() => setShowAIPrompt(false)}
              onWorkflowGenerated={(workflow) => {
                setShowAIPrompt(false);
                onWorkflowSelected(workflow);
              }}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowAIPrompt(true)}
        className="group relative block h-[350px] w-full flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl text-left"
      >
        <img
          src="/thumbnails-wf-ai.jpeg"
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover blur-2xl transition-transform duration-300 group-hover:scale-[1.15]"
        />
        <div className="absolute inset-0 bg-[#191a1f]/80" />
        <div className="absolute inset-0 flex flex-col justify-center gap-4 p-10 sm:p-14">
          <h3 className="text-lg font-semibold tracking-tight text-white">Welcome to Openflows</h3>
          <p className="max-w-md text-xs leading-relaxed text-[#9aa0a6]">
            Describe what you need and let AI help you start a workflow on the canvas.
          </p>
          <span className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-medium text-[#191a1f] transition-colors hover:bg-[#e8eaed]">
            Generate with AI
          </span>
        </div>
      </button>
    </>
  );
}
