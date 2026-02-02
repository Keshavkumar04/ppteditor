import { useState, useEffect, useRef } from 'react'
// Theme editor dialog for creating and editing themes
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HexColorPicker } from 'react-colorful'
import { useThemes } from '@/context'
import { PresentationTheme, ColorScheme, FontScheme, Background } from '@/types'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface ThemeEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: PresentationTheme | null
  onSave?: (theme: PresentationTheme) => void
}

export function ThemeEditorDialog({
  open,
  onOpenChange,
  theme,
  onSave,
}: ThemeEditorDialogProps) {
  const { saveTheme } = useThemes()
  const [editedTheme, setEditedTheme] = useState<PresentationTheme | null>(null)

  // Initialize edited theme when dialog opens
  useEffect(() => {
    if (theme && open) {
      setEditedTheme({
        ...theme,
        colorScheme: { ...theme.colorScheme },
        fontScheme: {
          majorFont: { ...theme.fontScheme.majorFont },
          minorFont: { ...theme.fontScheme.minorFont },
        },
        defaultBackground: { ...theme.defaultBackground },
      })
    }
  }, [theme, open])

  if (!editedTheme) return null

  const handleSave = () => {
    saveTheme(editedTheme)
    onSave?.(editedTheme)
    onOpenChange(false)
  }

  const updateColorScheme = (key: keyof ColorScheme, value: string) => {
    setEditedTheme(prev => prev ? {
      ...prev,
      colorScheme: { ...prev.colorScheme, [key]: value },
    } : null)
  }

  const updateFontScheme = (type: 'majorFont' | 'minorFont', value: string) => {
    setEditedTheme(prev => prev ? {
      ...prev,
      fontScheme: {
        ...prev.fontScheme,
        [type]: { latin: value },
      },
    } : null)
  }

  const updateBackground = (background: Background) => {
    setEditedTheme(prev => prev ? {
      ...prev,
      defaultBackground: background,
    } : null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {theme?.id?.startsWith('custom_') || !theme?.id ? 'Create Theme' : 'Edit Theme'}
          </DialogTitle>
          <DialogDescription>
            Customize colors, fonts, and default background
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Theme Name */}
          <div className="space-y-2">
            <Label htmlFor="theme-name">Theme Name</Label>
            <Input
              id="theme-name"
              value={editedTheme.name}
              onChange={(e) => setEditedTheme(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder="Enter theme name"
            />
          </div>

          <Tabs defaultValue="colors">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="fonts">Fonts</TabsTrigger>
              <TabsTrigger value="background">Background</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[45vh] mt-4">
              {/* Colors Tab */}
              <TabsContent value="colors" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ColorField
                    label="Dark 1 (Primary Text)"
                    color={editedTheme.colorScheme.dark1}
                    onChange={(c) => updateColorScheme('dark1', c)}
                  />
                  <ColorField
                    label="Light 1 (Background)"
                    color={editedTheme.colorScheme.light1}
                    onChange={(c) => updateColorScheme('light1', c)}
                  />
                  <ColorField
                    label="Dark 2 (Secondary Text)"
                    color={editedTheme.colorScheme.dark2}
                    onChange={(c) => updateColorScheme('dark2', c)}
                  />
                  <ColorField
                    label="Light 2 (Alt Background)"
                    color={editedTheme.colorScheme.light2}
                    onChange={(c) => updateColorScheme('light2', c)}
                  />
                </div>

                <div className="pt-4">
                  <Label className="text-xs text-muted-foreground uppercase">Accent Colors</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <ColorField
                      label="Accent 1"
                      color={editedTheme.colorScheme.accent1}
                      onChange={(c) => updateColorScheme('accent1', c)}
                    />
                    <ColorField
                      label="Accent 2"
                      color={editedTheme.colorScheme.accent2}
                      onChange={(c) => updateColorScheme('accent2', c)}
                    />
                    <ColorField
                      label="Accent 3"
                      color={editedTheme.colorScheme.accent3}
                      onChange={(c) => updateColorScheme('accent3', c)}
                    />
                    <ColorField
                      label="Accent 4"
                      color={editedTheme.colorScheme.accent4}
                      onChange={(c) => updateColorScheme('accent4', c)}
                    />
                    <ColorField
                      label="Accent 5"
                      color={editedTheme.colorScheme.accent5}
                      onChange={(c) => updateColorScheme('accent5', c)}
                    />
                    <ColorField
                      label="Accent 6"
                      color={editedTheme.colorScheme.accent6}
                      onChange={(c) => updateColorScheme('accent6', c)}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Label className="text-xs text-muted-foreground uppercase">Links</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <ColorField
                      label="Hyperlink"
                      color={editedTheme.colorScheme.hyperlink}
                      onChange={(c) => updateColorScheme('hyperlink', c)}
                    />
                    <ColorField
                      label="Followed Link"
                      color={editedTheme.colorScheme.followedHyperlink}
                      onChange={(c) => updateColorScheme('followedHyperlink', c)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Fonts Tab */}
              <TabsContent value="fonts" className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Heading Font (Major)</Label>
                    <select
                      className="w-full h-10 px-3 border rounded-md"
                      value={editedTheme.fontScheme.majorFont.latin}
                      onChange={(e) => updateFontScheme('majorFont', e.target.value)}
                    >
                      <option value="Calibri Light">Calibri Light</option>
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Trebuchet MS">Trebuchet MS</option>
                      <option value="Impact">Impact</option>
                    </select>
                    <div
                      className="p-4 border rounded-md mt-2"
                      style={{ fontFamily: editedTheme.fontScheme.majorFont.latin }}
                    >
                      <span className="text-2xl">Heading Preview</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Body Font (Minor)</Label>
                    <select
                      className="w-full h-10 px-3 border rounded-md"
                      value={editedTheme.fontScheme.minorFont.latin}
                      onChange={(e) => updateFontScheme('minorFont', e.target.value)}
                    >
                      <option value="Calibri">Calibri</option>
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Open Sans">Open Sans</option>
                      <option value="Roboto">Roboto</option>
                    </select>
                    <div
                      className="p-4 border rounded-md mt-2"
                      style={{ fontFamily: editedTheme.fontScheme.minorFont.latin }}
                    >
                      <span className="text-base">Body text preview. The quick brown fox jumps over the lazy dog.</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Background Tab */}
              <TabsContent value="background" className="space-y-4">
                <BackgroundEditor
                  background={editedTheme.defaultBackground}
                  onChange={updateBackground}
                  colorScheme={editedTheme.colorScheme}
                  fontScheme={editedTheme.fontScheme}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Theme
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ColorFieldProps {
  label: string
  color: string
  onChange: (color: string) => void
}

function ColorField({ label, color, onChange }: ColorFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-full h-9 rounded border flex items-center gap-2 px-2 hover:bg-muted/50"
          >
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-mono">{color}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <HexColorPicker color={color} onChange={onChange} />
          <input
            type="text"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="w-full mt-2 h-8 px-2 text-sm border rounded font-mono"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface BackgroundEditorProps {
  background: Background
  onChange: (background: Background) => void
  colorScheme: ColorScheme
  fontScheme: FontScheme
}

function BackgroundEditor({ background, onChange, colorScheme, fontScheme }: BackgroundEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      onChange({
        type: 'image',
        imageUrl,
        imageFit: background.imageFit || 'cover',
      })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    onChange({ type: 'solid', color: '#FFFFFF' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getBackgroundStyle = (): React.CSSProperties => {
    switch (background.type) {
      case 'image':
        return {
          backgroundImage: background.imageUrl ? `url(${background.imageUrl})` : undefined,
          backgroundSize: background.imageFit === 'tile' ? 'auto' : background.imageFit || 'cover',
          backgroundRepeat: background.imageFit === 'tile' ? 'repeat' : 'no-repeat',
          backgroundPosition: 'center',
        }
      case 'gradient':
        if (background.gradient) {
          const stops = background.gradient.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')
          if (background.gradient.type === 'linear') {
            return { background: `linear-gradient(${background.gradient.angle || 0}deg, ${stops})` }
          } else {
            return { background: `radial-gradient(circle, ${stops})` }
          }
        }
        return { backgroundColor: '#FFFFFF' }
      case 'solid':
      default:
        return { backgroundColor: background.color || '#FFFFFF' }
    }
  }

  return (
    <div className="space-y-4">
      {/* Background Type Selection */}
      <div className="space-y-2">
        <Label>Background Type</Label>
        <Select
          value={background.type}
          onValueChange={(value: 'solid' | 'gradient' | 'image') => {
            if (value === 'solid') {
              onChange({ type: 'solid', color: background.color || '#FFFFFF' })
            } else if (value === 'gradient') {
              onChange({
                type: 'gradient',
                gradient: background.gradient || {
                  type: 'linear',
                  angle: 45,
                  stops: [
                    { position: 0, color: '#FFFFFF' },
                    { position: 1, color: '#E0E0E0' },
                  ],
                },
              })
            } else if (value === 'image') {
              onChange({
                type: 'image',
                imageUrl: background.imageUrl,
                imageFit: 'cover',
              })
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Solid Color Options */}
      {background.type === 'solid' && (
        <div className="space-y-2">
          <ColorField
            label="Background Color"
            color={background.color || '#FFFFFF'}
            onChange={(c) => onChange({ type: 'solid', color: c })}
          />
        </div>
      )}

      {/* Gradient Options */}
      {background.type === 'gradient' && background.gradient && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Gradient Type</Label>
            <Select
              value={background.gradient.type}
              onValueChange={(value: 'linear' | 'radial') => {
                onChange({
                  ...background,
                  gradient: { ...background.gradient!, type: value },
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {background.gradient.type === 'linear' && (
            <div className="space-y-2">
              <Label className="text-xs">Angle: {background.gradient.angle || 0}°</Label>
              <input
                type="range"
                min="0"
                max="360"
                value={background.gradient.angle || 0}
                onChange={(e) => {
                  onChange({
                    ...background,
                    gradient: { ...background.gradient!, angle: parseInt(e.target.value) },
                  })
                }}
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ColorField
              label="Start Color"
              color={background.gradient.stops[0]?.color || '#FFFFFF'}
              onChange={(c) => {
                const newStops = [...background.gradient!.stops]
                newStops[0] = { ...newStops[0], color: c }
                onChange({
                  ...background,
                  gradient: { ...background.gradient!, stops: newStops },
                })
              }}
            />
            <ColorField
              label="End Color"
              color={background.gradient.stops[1]?.color || '#E0E0E0'}
              onChange={(c) => {
                const newStops = [...background.gradient!.stops]
                newStops[1] = { ...newStops[1], color: c }
                onChange({
                  ...background,
                  gradient: { ...background.gradient!, stops: newStops },
                })
              }}
            />
          </div>
        </div>
      )}

      {/* Image Options */}
      {background.type === 'image' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {background.imageUrl ? (
            <div className="space-y-2">
              <Label className="text-xs">Current Image</Label>
              <div className="relative w-full h-24 border rounded-md overflow-hidden">
                <img
                  src={background.imageUrl}
                  alt="Background"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Change Image
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to upload an image</span>
            </div>
          )}

          {background.imageUrl && (
            <div className="space-y-2">
              <Label className="text-xs">Image Fit</Label>
              <Select
                value={background.imageFit || 'cover'}
                onValueChange={(value: 'cover' | 'contain' | 'stretch' | 'tile') => {
                  onChange({ ...background, imageFit: value })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover (fill, may crop)</SelectItem>
                  <SelectItem value="contain">Contain (fit, may letterbox)</SelectItem>
                  <SelectItem value="stretch">Stretch (distort to fill)</SelectItem>
                  <SelectItem value="tile">Tile (repeat pattern)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      <div className="space-y-2">
        <Label>Preview</Label>
        <div
          className="w-full h-40 border rounded-md relative"
          style={getBackgroundStyle()}
        >
          <div className="absolute inset-4 flex flex-col justify-between">
            <div
              style={{
                fontFamily: fontScheme.majorFont.latin,
                color: colorScheme.dark1,
                fontSize: '20px',
                textShadow: background.type === 'image' ? '0 1px 2px rgba(0,0,0,0.5)' : undefined,
              }}
            >
              Slide Title
            </div>
            <div
              style={{
                fontFamily: fontScheme.minorFont.latin,
                color: colorScheme.dark2,
                fontSize: '12px',
                textShadow: background.type === 'image' ? '0 1px 2px rgba(0,0,0,0.5)' : undefined,
              }}
            >
              Body text goes here
            </div>
            <div className="flex gap-1">
              {[
                colorScheme.accent1,
                colorScheme.accent2,
                colorScheme.accent3,
                colorScheme.accent4,
              ].map((color, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
