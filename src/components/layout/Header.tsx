import React, { useState, useRef } from 'react'
import {
  FileText,
  FolderOpen,
  Download,
  Plus,
  ChevronDown,
  Undo2,
  Redo2,
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { usePresentation } from '@/context'
import { useHistory } from '@/context'
import { cn } from '@/lib/utils'

interface HeaderProps {
  className?: string
  onImport?: () => void
  onExport?: () => void
  onTheme?: () => void
}

export function Header({ className, onImport, onExport, onTheme }: HeaderProps) {
  const { presentation, createNewPresentation, setPresentationName, isDirty } = usePresentation()
  const { canUndo, canRedo, undo, redo } = useHistory()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleStartEditName = () => {
    if (presentation) {
      setEditedName(presentation.name)
      setIsEditingName(true)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }

  const handleSaveName = () => {
    if (editedName.trim()) {
      setPresentationName(editedName.trim())
    }
    setIsEditingName(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const handleNewPresentation = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Create new presentation anyway?')) {
        createNewPresentation()
      }
    } else {
      createNewPresentation()
    }
  }

  return (
    <header className={cn('flex items-center gap-2 px-4 bg-background border-b', className)}>
      {/* Logo/Brand */}
      <div className="flex items-center gap-2 mr-4">
        <FileText className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg hidden sm:inline">PPT Editor</span>
      </div>

      {/* File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            File
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleNewPresentation}>
            <Plus className="h-4 w-4 mr-2" />
            New Presentation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onImport}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Import PPTX...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport} disabled={!presentation}>
            <Download className="h-4 w-4 mr-2" />
            Export as PPTX
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            Edit
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => undo()} disabled={!canUndo}>
            <Undo2 className="h-4 w-4 mr-2" />
            Undo
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+Z</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => redo()} disabled={!canRedo}>
            <Redo2 className="h-4 w-4 mr-2" />
            Redo
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+Y</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme Button */}
      <Button variant="ghost" size="sm" className="gap-1" onClick={onTheme}>
        <Palette className="h-4 w-4" />
        Theme
      </Button>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Undo/Redo Quick Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* Presentation Name */}
      <div className="flex-1 flex items-center justify-center">
        {presentation && (
          isEditingName ? (
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
              className="max-w-xs h-8 text-center"
              autoFocus
            />
          ) : (
            <button
              onClick={handleStartEditName}
              className="text-sm font-medium hover:bg-muted px-3 py-1 rounded transition-colors"
            >
              {presentation.name}
              {isDirty && <span className="text-muted-foreground ml-1">*</span>}
            </button>
          )
        )}
      </div>

      {/* Right side - could add user menu, share button, etc */}
      <div className="flex items-center gap-2">
        {/* Placeholder for future features */}
      </div>
    </header>
  )
}
