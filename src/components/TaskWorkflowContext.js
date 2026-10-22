"use client";

// The open project's workflow (its statuses, in board order) for everything inside the
// Tasks tab. Outside it (the top bar's search) the default workflow applies.

import { createContext, useContext } from "react";
import { DEFAULT_WORKFLOW } from "@/lib/taskWorkflow";

const WorkflowContext = createContext(DEFAULT_WORKFLOW);

export const TaskWorkflowProvider = WorkflowContext.Provider;
export const useWorkflow = () => useContext(WorkflowContext);
