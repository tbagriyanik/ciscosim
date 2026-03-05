'use client';

import { Badge } from '@/components/ui/badge';
import { TaskDefinition, TaskContext, getTaskStatus } from '@/lib/cisco/taskDefinitions';
import { SwitchState } from '@/lib/cisco/types';
import { useRef, useEffect, useState } from 'react';

interface TaskCardProps {
  tasks: TaskDefinition[];
  state: SwitchState;
  context: TaskContext;
  color: string;
  isDark: boolean;
}

export function TaskCard({ tasks, state, context, color, isDark }: TaskCardProps) {
  // Use ref to track previous completed tasks (avoids infinite loop)
  const prevCompletedRef = useRef<Set<string>>(new Set());
  const [animatingTask, setAnimatingTask] = useState<string | null>(null);
  
  // Calculate score
  const score = tasks.reduce((acc, task) => {
    const completed = getTaskStatus(task, state, context);
    return acc + (completed ? task.weight : 0);
  }, 0);

  // Calculate max score
  const maxScore = tasks.reduce((acc, task) => acc + task.weight, 0);
  
  // Track task completion changes for animation - using ref to avoid infinite loop
  useEffect(() => {
    const newCompleted = new Set<string>();
    tasks.forEach(task => {
      if (getTaskStatus(task, state, context)) {
        newCompleted.add(task.id);
      }
    });
    
    // Find newly completed tasks by comparing with ref
    newCompleted.forEach(taskId => {
      if (!prevCompletedRef.current.has(taskId)) {
        setAnimatingTask(taskId);
        setTimeout(() => setAnimatingTask(null), 600);
      }
    });
    
    // Update ref for next comparison
    prevCompletedRef.current = newCompleted;
  }, [tasks, state, context]);

  return (
    <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-white/80'} backdrop-blur-sm border ${isDark ? 'border-slate-700' : 'border-slate-200'} transition-all duration-300 hover:shadow-lg`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'} flex items-center gap-2`}>
          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {context.language === 'tr' ? 'Görevler' : 'Tasks'}
        </h3>
        <Badge className={`bg-gradient-to-r ${color} text-white border-0 transition-transform duration-300 hover:scale-105`}>
          {score}/{maxScore}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className={`h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-4 overflow-hidden`}>
        <div 
          className={`h-full bg-gradient-to-r ${color} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${(score / maxScore) * 100}%` }}
        />
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.map((task, index) => {
          const completed = getTaskStatus(task, state, context);
          const name = task.name[context.language];
          const description = task.description[context.language];
          const tip = task.tip[context.language];
          const isAnimating = animatingTask === task.id;

          return (
            <div
              key={task.id}
              className={`p-2.5 rounded-lg transition-all duration-300 ${
                completed
                  ? 'bg-green-500/10 border border-green-500/20'
                  : isDark ? 'bg-slate-700/30 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200/80'
              } ${isAnimating ? 'animate-scale-in ring-2 ring-green-400/50' : ''}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Task Header */}
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  completed
                    ? 'bg-green-500 text-white scale-110'
                    : isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'
                }`}>
                  {completed ? (
                    <svg className={`w-3 h-3 ${isAnimating ? 'animate-success-pop' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-bold">{task.weight}</span>
                  )}
                </div>
                <span className={`text-sm font-medium transition-all duration-300 ${
                  completed ? 'text-green-400 line-through opacity-80' : isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {name}
                </span>
              </div>

              {/* Description */}
              <p className={`text-xs ml-7 transition-opacity duration-300 ${
                completed ? 'opacity-50' : ''
              } ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {description}
              </p>

              {/* Tip */}
              {!completed && (
                <div className={`flex items-start gap-1.5 mt-1.5 ml-7 group`}>
                  <svg className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-[11px] ${isDark ? 'text-cyan-400/80' : 'text-cyan-600'} transition-colors group-hover:text-cyan-500`}>
                    {tip}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
