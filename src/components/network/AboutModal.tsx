'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface AboutModalProps {
 isOpen: boolean;
 onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
 const { t } = useLanguage();

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="sm:max-w-[425px] md:max-w-xl lg:max-w-2xl">
 <DialogHeader>
 <DialogTitle>{t.aboutTitle}</DialogTitle>
 <DialogDescription>
 {t.aboutIntro}
 </DialogDescription>
 </DialogHeader>
 <ScrollArea className="h-72 w-full rounded-md border p-4">
 <h4 className="mb-4 text-lg font-bold">{t.termsAndConditions}</h4>
 <p className="text-sm">
 {t.termsText}
 </p>
 <div className="mt-4 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
 <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mb-1">Project Website:</p>
 <a 
 href="http://yunus.sf.net" 
 target="_blank" 
 rel="noopener noreferrer" 
 className="text-sm text-blue-500 hover:underline break-all"
 >
 http://yunus.sf.net
 </a>
 </div>
 <div className="mt-4">
 <a 
 href="https://tuzlamtal.meb.k12.tr" 
 target="_blank" 
 rel="noopener noreferrer" 
 className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
 >
 {t.licenseInfo}
 </a>
 </div>
 </ScrollArea>
 <div className="flex justify-end">
 <Button onClick={onClose}>{t.close}</Button>
 </div>
 </DialogContent>
 </Dialog>
 );
}
