
'use client';

import Image from 'next/image';
import { UploadCloud } from 'lucide-react';
import { useMagicMarkup } from '@/hooks/use-magic-markup';
import { Button } from '@/components/ui/button';
import { Header } from './header';
import { HistorySidebar } from './history-sidebar';
import { EditorCanvas } from './editor-canvas';
import { Toolbar } from './toolbar';
import { GeneratedImageDialog } from './generated-image-dialog';
import { ConfirmNewImageDialog } from './confirm-new-image-dialog';
import { ApiKeyDialog } from './api-key-dialog';

export function MagicMarkupEditor() {
  const hook = useMagicMarkup();

  if (!hook.isMounted) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onApiKeyClick={() => hook.setIsApiKeyDialogOpen(true)} />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[auto_1fr_350px]">
        <HistorySidebar
          isCameraRollOpen={hook.isCameraRollOpen}
          setIsCameraRollOpen={hook.setIsCameraRollOpen}
          handleNewSession={hook.handleNewSession}
          sessionHistory={hook.sessionHistory}
          activeHistoryId={hook.activeHistoryId}
          loadStateFromHistoryItem={hook.loadStateFromHistoryItem}
          handleDeleteHistoryItem={hook.handleDeleteHistoryItem}
        />

        <main className="flex flex-col items-center justify-center bg-background/50 p-4">
          {hook.baseImage ? (
            <EditorCanvas
              baseImage={hook.baseImage}
              canvasRef={hook.canvasRef}
              tool={hook.tool}
              handleCanvasMouseDown={hook.handleCanvasMouseDown}
              handleCanvasMouseMove={hook.handleCanvasMouseMove}
              handleCanvasMouseUp={hook.handleCanvasMouseUp}
              editingAnnotation={hook.editingAnnotation}
              handleSaveAnnotation={hook.handleSaveAnnotation}
              setEditingAnnotation={hook.setEditingAnnotation}
            />
          ) : (
            <div className="flex w-full h-full max-w-2xl max-h-[70vh] items-center justify-center rounded-2xl border-2 border-dashed border-border">
              <div className="text-center">
                <UploadCloud className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Upload or Paste Base Image</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start by uploading or pasting the image you want to edit.</p>
                <Button className="mt-4" onClick={() => hook.fileInputRef.current?.click()}>
                  Browse Files
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={hook.fileInputRef}
                  onChange={hook.handleBaseImageUpload}
                />
              </div>
            </div>
          )}
        </main>
        
        <Toolbar {...hook} />

        <ConfirmNewImageDialog
          isOpen={!!hook.confirmingNewImage}
          onOpenChange={(open) => !open && hook.setConfirmingNewImage(null)}
          onConfirm={hook.handleConfirmNewImage}
        />
        
        <GeneratedImageDialog
            isOpen={!!hook.generatedImage}
            onOpenChange={(open) => !open && hook.setGeneratedImage(null)}
            baseImage={hook.baseImage}
            generatedImage={hook.generatedImage}
            handleCopy={hook.handleCopy}
            handleDownload={hook.handleDownload}
            handleKeepEditing={hook.handleKeepEditing}
        />

        <ApiKeyDialog 
          isOpen={hook.isApiKeyDialogOpen}
          onOpenChange={hook.setIsApiKeyDialogOpen}
          onSave={hook.handleSaveApiKey}
          existingApiKey={hook.apiKey}
        />

      </div>
    </div>
  );
}
