'use client';

import { Badge } from '@/components/ui/badge';
import { TaskDefinition, TaskContext, getTaskStatus } from '@/lib/network/taskDefinitions';
import { SwitchState } from '@/lib/network/types';
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Calculate score
  const score = tasks.reduce((acc, task) => {
    const completed = getTaskStatus(task, state, context);
    return acc + (completed ? task.weight : 0);
  }, 0);

  // Calculate max score
  const maxScore = tasks.reduce((acc, task) => acc + task.weight, 0);
  const isCategoryComplete = score === maxScore && maxScore > 0;
  
  // Track task completion changes for animation
  useEffect(() => {
    const newCompleted = new Set<string>();
    let newlyFinishedCount = 0;

    tasks.forEach(task => {
      if (getTaskStatus(task, state, context)) {
        newCompleted.add(task.id);
        if (!prevCompletedRef.current.has(task.id)) {
          newlyFinishedCount++;
          setAnimatingTask(task.id);
          setTimeout(() => setAnimatingTask(null), 1000);
        }
      }
    });
    
    // Category completion celebration
    if (newlyFinishedCount > 0 && newCompleted.size === tasks.length) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
    
    // Update ref for next comparison
    prevCompletedRef.current = newCompleted;
  }, [tasks, state, context]);

  return (
    <div className={`relative rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-white/80'} backdrop-blur-sm border ${isDark ? 'border-slate-700' : 'border-slate-200'} transition-all duration-300 hover:shadow-lg overflow-hidden`}>
      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-green-500/10 backdrop-blur-[1px]"
          >
            <motion.div
              initial={{ scale: 0.5, y: 20 }}
              animate={{ scale: [1, 1.2, 1], y: 0 }}
              className="bg-white dark:bg-slate-900 px-4 py-2 rounded-full shadow-2xl border border-green-500/50 flex items-center gap-2"
            >
              <span className="text-xl">🎉</span>
              <span className="text-sm font-bold text-green-500 tracking-wider">
                {context.language === 'tr' ? 'Tebrikler!' : 'Completed!'}
              </span>
            </motion.div>
            
            {/* Particles simulation */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ 
                  x: (Math.random() - 0.5) * 300, 
                  y: (Math.random() - 0.5) * 300,
                  opacity: 0,
                  rotate: Math.random() * 360
                }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute w-2 h-2 rounded-full"
                style={{ 
                  backgroundColor: ['#22d3ee', '#fbbf24', '#f87171', '#4ade80'][i % 4]
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'} flex items-center gap-2`}>
          <svg className={`w-4 h-4 ${isCategoryComplete ? 'text-green-400 animate-bounce' : 'text-cyan-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 00-2 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {context.language === 'tr' ? 'Görevler' : 'Tasks'}
        </h3>
        <Badge className={`bg-gradient-to-r ${isCategoryComplete ? 'from-green-500 to-emerald-600' : color} text-white border-0 transition-all duration-500 ${isCategoryComplete ? 'scale-110 shadow-lg shadow-green-500/20' : 'hover:scale-105'}`}>
          {score}/{maxScore}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className={`h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-4 overflow-hidden`}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(score / maxScore) * 100}%` }}
          className={`h-full bg-gradient-to-r ${isCategoryComplete ? 'from-green-400 to-emerald-500' : color} rounded-full`}
          transition={{ duration: 0.8, ease: "easeOut" }}
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
            <motion.div
              key={task.id}
              initial={false}
              animate={{ 
                backgroundColor: completed 
                  ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)')
                  : (isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 1)'),
                borderColor: completed ? 'rgba(34, 197, 94, 0.2)' : 'transparent'
              }}
              className={`p-2.5 rounded-lg border transition-all duration-300 ${
                isAnimating ? 'ring-2 ring-green-400/50 scale-[1.02] z-10' : ''
              }`}
            >
              {/* Task Header */}
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                  completed
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'
                }`}>
                  {completed ? (
                    <motion.svg 
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-3 h-3" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </motion.svg>
                  ) : (
                    <span className="text-xs font-bold">{task.weight}</span>
                  )}
                </div>
                <span className={`text-sm font-medium transition-all duration-500 ${
                  completed ? 'text-green-500 line-through opacity-70' : isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {name}
                </span>
              </div>

              {/* Description */}
              <p className={`text-xs ml-7 transition-all duration-500 ${
                completed ? 'opacity-40' : ''
              } ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {description}
              </p>

              {/* Tip */}
              {!completed && (
                <div className="flex items-start gap-1.5 mt-1.5 ml-7 group cursor-help">
                  <svg className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-xs ${isDark ? 'text-cyan-400/80' : 'text-cyan-600'} transition-colors group-hover:text-cyan-400`}>
                    {tip}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

