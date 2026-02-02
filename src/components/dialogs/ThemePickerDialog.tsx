import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useThemes, usePresentation } from '@/context'
import { PresentationTheme } from '@/types'
import { Check, Pencil, Trash2, Plus, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditTheme?: (theme: PresentationTheme) => void
}

export function ThemePickerDialog({ open, onOpenChange, onEditTheme }: ThemePickerDialogProps) {
  const { builtInThemes, customThemes, deleteTheme, createTheme, duplicateTheme } = useThemes()
  const { presentation, setTheme } = usePresentation()
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(
    presentation?.theme?.id || null
  )

  const handleApplyTheme = () => {
    const allThemes = [...builtInThemes, ...customThemes]
    const theme = allThemes.find(t => t.id === selectedThemeId)
    if (theme) {
      setTheme(theme)
      onOpenChange(false)
    }
  }

  const handleDeleteTheme = (themeId: string) => {
    if (confirm('Are you sure you want to delete this theme?')) {
      deleteTheme(themeId)
      if (selectedThemeId === themeId) {
        setSelectedThemeId(null)
      }
    }
  }

  const handleCreateNew = () => {
    const newTheme = createTheme('My Custom Theme')
    if (onEditTheme) {
      onEditTheme(newTheme)
    }
  }

  const handleDuplicate = (themeId: string) => {
    const duplicated = duplicateTheme(themeId)
    if (duplicated && onEditTheme) {
      onEditTheme(duplicated)
    }
  }

  const handleEdit = (theme: PresentationTheme) => {
    if (onEditTheme) {
      onEditTheme(theme)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose Theme</DialogTitle>
          <DialogDescription>
            Select a theme for your presentation or create a custom one
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-6">
            {/* Built-in Themes */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Built-in Themes</h3>
              <div className="grid grid-cols-3 gap-3">
                {builtInThemes.map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={selectedThemeId === theme.id}
                    isCurrent={presentation?.theme?.id === theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    onDuplicate={() => handleDuplicate(theme.id)}
                  />
                ))}
              </div>
            </div>

            {/* Custom Themes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Custom Themes</h3>
                <Button variant="outline" size="sm" onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Theme
                </Button>
              </div>
              {customThemes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No custom themes yet. Create one to get started.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {customThemes.map(theme => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      isSelected={selectedThemeId === theme.id}
                      isCurrent={presentation?.theme?.id === theme.id}
                      onClick={() => setSelectedThemeId(theme.id)}
                      onEdit={() => handleEdit(theme)}
                      onDelete={() => handleDeleteTheme(theme.id)}
                      onDuplicate={() => handleDuplicate(theme.id)}
                      isCustom
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApplyTheme} disabled={!selectedThemeId}>
            Apply Theme
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ThemeCardProps {
  theme: PresentationTheme
  isSelected: boolean
  isCurrent: boolean
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  isCustom?: boolean
}

function ThemeCard({
  theme,
  isSelected,
  isCurrent,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  isCustom,
}: ThemeCardProps) {
  const { colorScheme } = theme

  return (
    <div
      className={cn(
        'relative border rounded-lg p-2 cursor-pointer transition-all',
        isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-muted-foreground/50',
        isCurrent && 'border-green-500'
      )}
      onClick={onClick}
    >
      {/* Theme Preview */}
      <div
        className="h-20 rounded mb-2 relative overflow-hidden"
        style={{ backgroundColor: colorScheme.background1 }}
      >
        {/* Color swatches */}
        <div className="absolute bottom-2 left-2 right-2 flex gap-1">
          <div
            className="w-4 h-4 rounded-sm border border-white/20"
            style={{ backgroundColor: colorScheme.accent1 }}
          />
          <div
            className="w-4 h-4 rounded-sm border border-white/20"
            style={{ backgroundColor: colorScheme.accent2 }}
          />
          <div
            className="w-4 h-4 rounded-sm border border-white/20"
            style={{ backgroundColor: colorScheme.accent3 }}
          />
          <div
            className="w-4 h-4 rounded-sm border border-white/20"
            style={{ backgroundColor: colorScheme.accent4 }}
          />
          <div
            className="w-4 h-4 rounded-sm border border-white/20"
            style={{ backgroundColor: colorScheme.accent5 }}
          />
          <div
            className="w-4 h-4 rounded-sm border border-white/20"
            style={{ backgroundColor: colorScheme.accent6 }}
          />
        </div>

        {/* Sample text */}
        <div className="absolute top-2 left-2 text-xs font-semibold" style={{ color: colorScheme.text1 }}>
          Aa
        </div>
      </div>

      {/* Theme Name */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{theme.name}</span>
        {isCurrent && (
          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
        )}
      </div>

      {/* Action buttons for custom themes */}
      {(isCustom || onDuplicate) && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
          {onDuplicate && (
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
