import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface RecoveryDialogProps {
  open: boolean
  onRecover: () => void
  onDiscard: () => void
  timestamp?: string
}

export function RecoveryDialog({ open, onRecover, onDiscard, timestamp }: RecoveryDialogProps) {
  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'unknown time'
    try {
      const date = new Date(ts)
      return date.toLocaleString()
    } catch {
      return 'unknown time'
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Recover Unsaved Work?
          </DialogTitle>
          <DialogDescription>
            We found an auto-saved presentation from {formatTimestamp(timestamp)}.
            Would you like to recover it or start fresh?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            If you choose to discard, the auto-saved data will be permanently deleted.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onDiscard}>
            Discard & Start New
          </Button>
          <Button onClick={onRecover}>
            Recover Presentation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
