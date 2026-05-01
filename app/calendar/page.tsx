"use client"

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react"
import { useMounted } from "@/hooks/useMounted"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  LogOut,
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  User as UserIcon,
  Trash2,
  X,
  List,
  LayoutGrid,
  Users,
  Copy,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarUI } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { Calendar, momentLocalizer, View } from "react-big-calendar"
import moment from "moment-timezone"
import "moment/locale/pt-br"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "./calendar-custom.css"
import "@/lib/i18n"
import { useTranslation } from "react-i18next"

// ─── Localizer ────────────────────────────────────────────────────────────────

moment.locale("pt-br")
moment.tz.setDefault("America/Sao_Paulo")

const localizer = momentLocalizer(moment)

import { useEvents, FormState, CalendarEvent } from "@/hooks/useEvents"

// ─── Types ────────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  title: "",
  start: null,
  end: null,
  startTime: "",
  endTime: "",
  allDay: false,
  status: 'pending',
  color: '#534AB7',
  clientIds: [],
  link: ""
}

const EVENT_COLORS = [
  { label: 'Roxo',   value: '#534AB7' },
  { label: 'Verde',  value: '#0F6E56' },
  { label: 'Coral',  value: '#993C1D' },
  { label: 'Azul',   value: '#185FA5' },
  { label: 'Âmbar',  value: '#854F0B' },
]

const VIEWS: { key: View; labelKey: string }[] = [
  { key: "agenda", labelKey: "calendar.agenda" },
  { key: "month", labelKey: "calendar.month" },
  { key: "week", labelKey: "calendar.week" },
  { key: "day", labelKey: "calendar.day" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ClientRow = {
  id: string
  user_id: string
  name: string
  process_number: string | null
  area: string | null
  date: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at?: string | null
}

const toLocal = (date: Date) => 
  moment(date).tz("America/Sao_Paulo") 

function toSafeDate(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12, 0, 0
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  const mounted = useMounted()
  const { t } = useTranslation()

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground tracking-widest uppercase">Loading</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground tracking-widest uppercase">{t("calendar.loading")}</p>
      </div>
    </div>
  )
}

function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  error = false,
}: {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  error?: boolean
}) {
  const [text, setText] = useState(value ? moment(value).format("DD/MM/YYYY") : "")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setText(value ? moment(value).format("DD/MM/YYYY") : "")
  }, [value])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "")
    if (val.length > 8) val = val.slice(0, 8)

    let formatted = val
    if (val.length > 2) formatted = val.slice(0, 2) + "/" + val.slice(2)
    if (val.length > 4) formatted = val.slice(0, 2) + "/" + val.slice(2, 4) + "/" + val.slice(4)

    setText(formatted)

    if (val.length === 8) {
      const d = moment(formatted, "DD/MM/YYYY", true)
      if (d.isValid()) {
        onChange(d.toDate())
      } else {
        onChange(null)
      }
    } else {
      onChange(null)
    }
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={handleTextChange}
            placeholder={placeholder}
            className={`h-10 text-[13px] bg-secondary/20 focus:ring-0 rounded-lg pr-9 transition-colors ${
              error ? "border-destructive focus:border-destructive" : "border-border/40 focus:border-primary/50"
            }`}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0 z-[100]" align="start">
          <CalendarUI
            mode="single"
            selected={value ?? undefined}
            onSelect={(date) => {
              onChange(date ?? null)
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Slide-over lateral para criar / editar evento (memo: evita reconciliação pesada quando o pai atualiza)
const EventSlideOver = memo(function EventSlideOver({
  open,
  form,
  selectedEventId,
  isSubmitting,
  isDeleting,
  clients,
  onClose,
  onChange,
  onSubmit,
  onDelete,
}: {
  open: boolean
  form: FormState
  selectedEventId: string | null
  isSubmitting: boolean
  isDeleting: boolean
  clients: ClientRow[]
  onClose: () => void
  onChange: (field: keyof FormState, value: any) => void
  onSubmit: (e: React.FormEvent) => void
  onDelete: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const [dateError, setDateError] = useState(false)

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      
      // Ignorar caso o clique tenha sido dentro de um dialog/popover do calendário (shadcn portal)
      if (target.closest('[data-slot="popover-content"]')) return

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose()
      }
    }
    // Delay para não capturar o clique que abriu
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 50)
    return () => {
      clearTimeout(id)
      document.removeEventListener("mousedown", handler)
    }
  }, [open, onClose])

  // Fechar com Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setDateError(false)
  }, [open])

  return (
    <>
      {/* Overlay — sem backdrop-blur (muito pesado sem GPU) */}
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      />

      {/* Painel — transform em camada composta */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full max-w-[min(100vw,420px)] z-50 bg-background border-l border-border/50 shadow-2xl flex flex-col transform-gpu will-change-transform transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {selectedEventId ? t("calendar.editEvent") : t("calendar.newEvent")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedEventId ? t("calendar.changeDetails") : t("calendar.fillDetails")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-4 flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("calendar.title")}
              </Label>
              <Input
                id="title"
                placeholder={t("calendar.titlePlaceholder")}
                value={form.title}
                onChange={(e) => onChange("title", e.target.value)}
                autoFocus
                required
                className="h-10 text-[13px] bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg"
              />
            </div>

            <div className="flex items-center space-x-2 py-2">
              <Checkbox
                id="allDay"
                checked={form.allDay}
                onCheckedChange={(checked) => onChange("allDay", !!checked)}
              />
              <Label
                htmlFor="allDay"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t("calendar.allDay")}
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("calendar.start")}
              </Label>
              <div className="flex flex-wrap gap-2">
                <DateInput
                  value={form.start}
                  onChange={(date) => {
                    onChange("start", date)
                    if (form.end && date && date > form.end) {
                      setDateError(true)
                    } else {
                      setDateError(false)
                    }
                  }}
                />
                {!form.allDay && (
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => onChange("startTime", e.target.value)}
                    required
                    className="h-10 text-[13px] bg-secondary/20 border border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg cursor-text w-[110px] transition-colors hover:bg-secondary/30"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("calendar.end")}
              </Label>
              <div className="flex flex-wrap gap-2">
                <DateInput
                  value={form.end}
                  error={dateError}
                  onChange={(date) => {
                    onChange("end", date)
                    if (form.start && date && date < form.start) {
                      setDateError(true)
                    } else {
                      setDateError(false)
                    }
                  }}
                />
                {!form.allDay && (
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => onChange("endTime", e.target.value)}
                    required
                    className={`h-10 text-[13px] bg-secondary/20 border focus:ring-0 rounded-lg cursor-text w-[110px] transition-colors hover:bg-secondary/30 ${
                      dateError ? "border-destructive focus:border-destructive text-destructive" : "border-border/40 focus:border-primary/50"
                    }`}
                  />
                )}
              </div>
              {dateError ? (
                <p className="text-[11px] mt-1 text-destructive leading-tight font-medium">
                  A data de fim deve ser posterior à data de início.
                </p>
              ) : (
                <p className="text-[11px] mt-1 text-muted-foreground/60 leading-tight">
                  {form.allDay ? t("calendar.allDayDescription") : t("calendar.endTimeDescription")}
                </p>
              )}
            </div>

            {/* Clientes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("calendar.clients")}</Label>
              <div className="bg-secondary/10 border border-border/40 rounded-lg max-h-40 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                {clients.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground p-2 text-center leading-tight">Nenhum cliente cadastrado.</p>
                ) : (
                  clients.map(c => (
                    <label key={c.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-secondary/40 rounded-md cursor-pointer transition-colors select-none">
                      <Checkbox
                        className="mt-0.5"
                        checked={form.clientIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          const newIds = checked
                            ? [...form.clientIds, c.id]
                            : form.clientIds.filter(id => id !== c.id)
                          onChange("clientIds", newIds)
                        }}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium leading-none truncate">{c.name}</span>
                        {c.process_number && <span className="text-[10px] text-muted-foreground truncate mt-1 leading-none">{c.process_number}</span>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label htmlFor="link" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("calendar.link")}
              </Label>
              <Input
                id="link"
                placeholder={t("calendar.linkPlaceholder")}
                value={form.link || ""}
                onChange={(e) => onChange("link", e.target.value)}
                className="h-10 text-[13px] bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg"
              />
            </div>

            {/* Cor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("calendar.color")}</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onChange("color", c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                      form.color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Status — só ao editar */}
            {selectedEventId && (
              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="status"
                  checked={form.status === 'done'}
                  onCheckedChange={(v) => onChange("status", v ? 'done' : 'pending')}
                />
                <Label htmlFor="status" className="text-sm cursor-pointer">{t("calendar.markAsDone")}</Label>
              </div>
            )}
          </div>

          {/* Rodapé do painel */}
          <div className="px-6 py-5 border-t border-border/40 space-y-2">
            <Button
              type="submit"
              disabled={isSubmitting || dateError}
              className="w-full h-10 text-sm font-medium rounded-lg"
            >
              {isSubmitting ? t("calendar.saving") : selectedEventId ? t("calendar.saveChanges") : t("calendar.createEvent")}
            </Button>

            {selectedEventId && (
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={onDelete}
                className="w-full h-10 text-sm text-destructive hover:text-destructive hover:bg-destructive/8 rounded-lg gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? t("calendar.deleting") : t("calendar.deleteEvent")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  )
})

function CopyButton({ value, className = "" }: { value: string, className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = value.startsWith('http') ? value : `https://${value}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Link copiado!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-primary transition-colors cursor-pointer ${className}`}
      title={value}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

// Custom event card renderizado dentro do calendário
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const { t } = useTranslation()
  const diffH = (event.end.getTime() - event.start.getTime()) / 3_600_000
  const diffDays = Math.ceil(diffH / 24)

  let sub = ""
  if (event.allDay || diffH >= 24) {
    sub = diffDays > 1
      ? `${moment(event.start).format("D/MM")} – ${moment(event.end).format("D/MM")}`
      : t("calendar.allDay")
  }

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden leading-tight p-0.5">
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold truncate">{event.title}</span>
        {event.link && (
          <div className="hidden sm:flex items-center shrink-0">
            <Copy className="w-2.5 h-2.5 opacity-60" />
          </div>
        )}
      </div>
      {sub && <span className="opacity-75 truncate text-[10px] mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Escala em %; o tamanho base na página do calendário é 18px (16px + 2px) no passo 100%. */
function useFontSize() {
  const STEPS = [85, 100, 115, 130]
  const [step, setStep] = useState(1)

  useEffect(() => {
    const stored = Number(localStorage.getItem("agenda-font-step") ?? 1)
    setStep(Math.min(Math.max(stored, 0), 3))
  }, [])

  const changeFont = useCallback((d: number) => {
    setStep((prev) => {
      const next = Math.min(Math.max(prev + d, 0), 3)
      localStorage.setItem("agenda-font-step", String(next))
      return next
    })
  }, [])

  return { scale: STEPS[step], fontLabel: `${STEPS[step]}%`, changeFont }
}

const MiniCalendar = memo(function MiniCalendar({
  currentDate,
  events,
}: {
  currentDate: Date
  events: CalendarEvent[]
}) {
  const startOfMonth = moment(currentDate).startOf("month")
  const endOfMonth   = moment(currentDate).endOf("month")
  const startOfGrid  = startOfMonth.clone().startOf("week")
  const endOfGrid    = endOfMonth.clone().endOf("week")

  const days: moment.Moment[] = []
  const cursor = startOfGrid.clone()
  while (cursor.isSameOrBefore(endOfGrid, "day")) {
    days.push(cursor.clone())
    cursor.add(1, "day")
  }

  const eventDays = useMemo(() => {
    const set = new Set<string>()
    events.forEach(e => set.add(moment(e.start).format("YYYY-MM-DD")))
    return set
  }, [events])

  const weekDays = ["Do", "Se", "Te", "Qa", "Qi", "Sx", "Sa"]

  return (
    <div className="p-4">
      <p className="text-xs font-semibold capitalize text-foreground/70 mb-3">
        {startOfMonth.format("MMMM YYYY")}
      </p>

      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground/50 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const key      = day.format("YYYY-MM-DD")
          const isToday  = day.isSame(moment(), "day")
          const isMonth  = day.isSame(startOfMonth, "month")
          const hasEvent = eventDays.has(key)

          return (
            <div
              key={i}
              className={`relative flex flex-col items-center justify-center h-8 w-full rounded-md text-[11px] transition-colors cursor-default
                ${isToday
                  ? "text-primary font-bold bg-primary/5"
                  : isMonth
                    ? "text-foreground"
                    : "text-muted-foreground/30"
                }`}
            >
              {day.format("D")}
              {hasEvent && !isToday && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/30" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

function AgendaView({
  events,
  currentDate,
  onSelectEvent,
  onToggleStatus,
  onNavigate,
  clients,
  togglingIds,
}: {
  events: CalendarEvent[]
  currentDate: Date
  onSelectEvent: (e: CalendarEvent) => void
  onToggleStatus: (id: string) => void
  onNavigate: (date: Date) => void
  clients: ClientRow[]
  togglingIds: Set<string>
}) {
   const { t } = useTranslation()
   const [viewMode, setViewMode] = useState<'list' | 'grid'>('list') 
 
   // Agrupa e separa em "hoje+amanhã" vs "próximos" 
   const { nearGroups, futureGroups } = useMemo(() => { 
     const todayStartVal  = moment().startOf("day").valueOf() 
     const tomorrowEndVal = moment().add(1, "day").endOf("day").valueOf() 
     const monthStartVal  = moment(currentDate).startOf("month").valueOf() 
     const monthEndVal    = moment(currentDate).endOf("month").valueOf() 
 
     const filtered = events.filter(e => {
       const startVal = e.start.valueOf()
       const endVal = e.end.valueOf()
       return startVal < monthEndVal && 
              endVal > monthStartVal && 
              startVal >= todayStartVal
     })
 
     const map = new Map<string, CalendarEvent[]>() 
     for (const e of filtered) { 
       const key = toLocal(e.start).format("YYYY-MM-DD") 
       let group = map.get(key)
       if (!group) {
         group = []
         map.set(key, group)
       }
       group.push(e)
     } 
 
     const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)) 
 
     const near:   typeof sorted = [] 
     const future: typeof sorted = [] 
 
     for (const entry of sorted) { 
       const [dateKey] = entry
       const dVal = moment(dateKey).valueOf() 
       if (dVal <= tomorrowEndVal) { 
         near.push(entry) 
       } else { 
         future.push(entry) 
       } 
     } 
 
     return { nearGroups: near, futureGroups: future } 
   }, [events, currentDate]) 
 
   function duration(e: CalendarEvent) { 
     if (e.allDay) return null 
     const mins = Math.round((e.end.getTime() - e.start.getTime()) / 60000) 
     if (mins < 60) return `${mins}min` 
     const h = Math.floor(mins / 60), m = mins % 60 
     return m > 0 ? `${h}h${m}` : `${h}h` 
   } 
 
   const totalNear   = nearGroups.reduce((acc, [, evs]) => acc + evs.length, 0) 
   const totalFuture = futureGroups.reduce((acc, [, evs]) => acc + evs.length, 0) 
 
   const isEmpty = nearGroups.length === 0 && futureGroups.length === 0 
 
   function renderDayBlock( 
     dateKey: string, 
     dayEvents: CalendarEvent[], 
     dimmed = false 
   ) { 
     const day     = moment(dateKey) 
     const isToday = day.isSame(moment(), "day") 
 
     return ( 
       <div id={`day-${dateKey}`} key={dateKey} className={`mb-5 ${dimmed ? "opacity-70" : ""}`}> 
         {/* Cabeçalho do dia */} 
         <div className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-2 ${isToday ? "-mx-2 px-2 py-1.5 bg-primary/[0.04] rounded-lg" : ""}`}> 
           <span className={`font-medium leading-none ${ 
             isToday ? "text-4xl text-primary" : "text-3xl text-foreground" 
           }`}> 
             {day.format("D")} 
           </span> 
           <span className="text-xs text-muted-foreground capitalize"> 
             {day.format("dddd")} 
           </span> 
           <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full border border-border/20"> 
             {t("calendar.eventsCount", { count: dayEvents.length })}
           </span> 
         </div> 
 
         {/* Lista */} 
         {viewMode === "list" && ( 
           <div className="flex flex-col"> 
             {dayEvents.map(e => ( 
               <div 
                 key={e.id} 
                 className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5 rounded-lg hover:bg-secondary/30 transition-colors border-b border-border/[0.07] last:border-b-0 cursor-pointer min-w-0" 
                 onClick={() => onSelectEvent(e)} 
               > 
                 <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} /> 
                 <span className="text-xs text-muted-foreground min-w-[100px] shrink-0 tabular-nums"> 
                   {e.allDay 
                     ? t("calendar.allDay") 
                     : `${toLocal(e.start).format("HH:mm")} – ${toLocal(e.end).format("HH:mm")}`} 
                 </span> 
                 <div className="flex flex-col flex-1 min-w-0">
                   <span className={`text-sm font-medium truncate ${ 
                     e.status === "done" ? "line-through text-muted-foreground" : "" 
                   }`}> 
                     {e.title} 
                   </span>
                   {e.clientIds.length > 0 && (() => {
                     const name = clients.find(c => c.id === e.clientIds[0])?.name
                     return name ? (
                       <span className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                         {name}{e.clientIds.length > 1 ? ` +${e.clientIds.length - 1}` : ""}
                       </span>
                     ) : null
                   })()}
                 </div>
                 <div className="flex items-center gap-1.5 shrink-0"> 
                   {e.link && (
                     <div className="flex items-center gap-2 mr-2">
                       <span className="hidden xl:inline text-[11px] text-muted-foreground max-w-[150px] truncate opacity-60">
                         {e.link}
                       </span>
                       <CopyButton value={e.link} />
                     </div>
                   )}
                   {duration(e) && ( 
                     <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground"> 
                       {duration(e)} 
                     </span> 
                   )} 
                   <button 
                    onClick={ev => { ev.stopPropagation(); onToggleStatus(e.id) }} 
                    disabled={togglingIds.has(e.id)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all ${ 
                      togglingIds.has(e.id) 
                        ? "bg-secondary text-muted-foreground border-border animate-pulse cursor-wait"
                        : e.status === "done" 
                          ? "bg-[#EAF3DE] text-[#27500A] border-[#C0DD97]" 
                          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" 
                    }`} 
                  > 
                    {togglingIds.has(e.id) 
                      ? "..." 
                      : e.status === "done" ? t("calendar.done") : t("calendar.pending")} 
                  </button> 
                </div> 
              </div> 
            ))} 
          </div> 
        )} 
 
        {/* Grid */} 
        {viewMode === "grid" && ( 
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 justify-items-center"> 
            {dayEvents.map(e => ( 
              <div 
                key={e.id} 
                onClick={() => onSelectEvent(e)} 
                className="relative w-full max-w-sm min-w-0 bg-background border border-border/40 rounded-xl p-3 pl-4 cursor-pointer hover:border-border/70 transition-colors overflow-hidden" 
              > 
                <div 
                  className="absolute left-0 top-0 bottom-0 w-[3px]" 
                  style={{ background: e.color, borderRadius: 0 }} 
                /> 
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[11px] text-muted-foreground tabular-nums"> 
                    {e.allDay 
                      ? t("calendar.allDay") 
                      : `${toLocal(e.start).format("HH:mm")} – ${toLocal(e.end).format("HH:mm")}`} 
                  </p> 
                  <button 
                    onClick={ev => { ev.stopPropagation(); onToggleStatus(e.id) }} 
                    disabled={togglingIds.has(e.id)}
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border transition-all ${ 
                      togglingIds.has(e.id) 
                        ? "bg-secondary text-muted-foreground border-border animate-pulse cursor-wait"
                        : e.status === "done" 
                          ? "bg-[#EAF3DE]/50 text-[#27500A] border-[#C0DD97]/40" 
                          : "bg-amber-50/50 text-amber-700 border-amber-200/40 hover:bg-amber-100/50" 
                    }`} 
                  > 
                    {togglingIds.has(e.id) ? "..." : e.status === "done" ? t("calendar.done") : t("calendar.pending")}
                  </button>
                </div>
                   <p className={`text-sm font-medium truncate ${ 
                     e.status === "done" ? "line-through text-muted-foreground" : "" 
                   }`}> 
                     {e.title} 
                   </p>
                   {e.clientIds.length > 0 && (() => {
                    const name = clients.find(c => c.id === e.clientIds[0])?.name
                    return name ? (
                      <span className="text-[11px] text-muted-foreground truncate leading-tight">
                        {name}{e.clientIds.length > 1 ? ` +${e.clientIds.length - 1}` : ""}
                      </span>
                    ) : null
                  })()}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5"> 
                    {e.link && (
                      <div className="flex items-center gap-2 mr-1">
                        <span className="hidden md:inline text-[11px] text-muted-foreground max-w-[120px] truncate opacity-60">
                          {e.link}
                        </span>
                        <CopyButton value={e.link} />
                      </div>
                    )}
                    {duration(e) && ( 
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground"> 
                        {duration(e)} 
                      </span> 
                    )} 
                    <button 
                      onClick={ev => { ev.stopPropagation(); onToggleStatus(e.id) }} 
                      disabled={togglingIds.has(e.id)}
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all ${ 
                        togglingIds.has(e.id)
                          ? "bg-secondary text-muted-foreground border-border animate-pulse cursor-wait"
                          : e.status === "done" 
                            ? "bg-[#EAF3DE] text-[#27500A] border-[#C0DD97]" 
                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" 
                      }`} 
                    > 
                      {togglingIds.has(e.id) 
                        ? "..." 
                        : e.status === "done" ? t("calendar.done") : t("calendar.pending")} 
                    </button> 
                  </div> 
                </div> 
              ))} 
            </div> 
          )}
        </div>
      )
    }
 
  return (
    <div className="h-full flex overflow-hidden">
  
      {/* ── Sidebar: mini calendário ── */}
      <div className="flex flex-col w-64 shrink-0 border-r border-border/30 overflow-y-auto">
        <MiniCalendar
          currentDate={currentDate}
          events={events}
        />
      </div>
  
      {/* ── Área principal ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
  
        {/* Subcabeçalho sticky */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/30 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {t("calendar.monthlySummary")}
          </p>
          <div className="flex items-center bg-secondary/40 rounded-lg p-1 gap-1">
            {(["list", "grid"] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === v
                    ? "bg-background text-foreground border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "list"
                  ? <List className="w-3.5 h-3.5" />
                  : <LayoutGrid className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>
  
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-[calc(100%-48px)] text-muted-foreground gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/50">{t("calendar.noEventsFound")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Nenhum evento programado para este mês.</p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-1">
  
            {nearGroups.length > 0 && (
              <>
                <div className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary whitespace-nowrap">
                    {t("calendar.todayAndTomorrow")}
                  </span>
                  <div className="flex-1 h-px bg-primary/20" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {t("calendar.eventsCount", { count: totalNear })}
                  </span>
                </div>
                {nearGroups.map(([dateKey, dayEvents]) =>
                  renderDayBlock(dateKey, dayEvents, false)
                )}
              </>
            )}
  
            {futureGroups.length > 0 && (
              <>
                <div className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {t("calendar.upcomingDays")}
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {t("calendar.eventsCount", { count: totalFuture })}
                  </span>
                </div>
                {futureGroups.map(([dateKey, dayEvents]) =>
                  renderDayBlock(dateKey, dayEvents, true)
                )}
              </>
            )}
  
            <div className="pt-6 pb-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">fim do período</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
  
          </div>
        )}
      </div>
    </div>
  )
}

/** Área do calendário isolada com memo: não re-renderiza o Big Calendar ao digitar no slide-over. */
type CalendarWorkAreaProps = {
  currentView: View
  events: CalendarEvent[]
  displayEvents: CalendarEvent[]
  currentDate: Date
  setCurrentView: (v: View) => void
  setCurrentDate: (d: Date) => void
  openEditEvent: (e: CalendarEvent) => void
  onToggleStatus: (id: string) => void
  onNavigate: (date: Date) => void
  eventPropGetter: (event: CalendarEvent) => { style: React.CSSProperties }
  calendarComponents: { toolbar: () => null; event: typeof CustomEvent }
  calendarMessages: Record<string, string>
  clients: ClientRow[]
  togglingIds: Set<string>
}

const CalendarWorkArea = memo(function CalendarWorkArea({
  currentView,
  events,
  displayEvents,
  currentDate,
  setCurrentView,
  setCurrentDate,
  openEditEvent,
  onToggleStatus,
  onNavigate,
  eventPropGetter,
  calendarComponents,
  calendarMessages,
  clients,
  togglingIds,
}: CalendarWorkAreaProps) {
  return (
    <main className="flex-1 min-h-0 p-3 sm:p-4">
      <div className="h-full rounded-xl border border-border/40 overflow-hidden bg-background">
        {currentView === "agenda" ? (
          <AgendaView
            events={events}
            currentDate={currentDate}
            onSelectEvent={openEditEvent}
            onToggleStatus={onToggleStatus}
            onNavigate={onNavigate}
            clients={clients}
            togglingIds={togglingIds}
          />
        ) : (
          <Calendar
            localizer={localizer}
            events={displayEvents}
            startAccessor="start"
            endAccessor="end"
            culture="pt-br"
            view={currentView}
            date={currentDate}
            onView={setCurrentView}
            onNavigate={setCurrentDate}
            onSelectEvent={openEditEvent}
            eventPropGetter={eventPropGetter}
            components={calendarComponents}
            messages={calendarMessages}
            className="custom-calendar-theme h-full"
          />
        )}
      </div>
    </main>
  )
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  
  const { events, fetchEvents, toggleStatus, togglingIds, deleteEvent, saveEvent } = useEvents()
  const [sessionUser, setSessionUser] = useState<{ id: string, email: string } | null>(null)

  const { scale, fontLabel, changeFont } = useFontSize()

  useEffect(() => {
    const px = (18 * scale) / 100
    document.documentElement.style.fontSize = `${px}px`
    return () => {
      document.documentElement.style.fontSize = ""
    }
  }, [scale])

  // Slide-over
  const [panelOpen, setPanelOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calendário
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>("agenda")

   const displayEvents = useMemo(() => { 
  if (currentView !== "month") return events 
 
  return events.map(e => { 
    if (e.allDay) return e 
 
    return { 
      ...e, 
      start: toSafeDate(e.start), 
      end: toSafeDate(e.end), 
    } 
  }) 
 }, [events, currentView]) 

  const { theme, setTheme } = useTheme()
  const [clients, setClients] = useState<ClientRow[]>([])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchClients = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true })
    setClients((data as ClientRow[]) ?? [])
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (mounted) router.push("/login")
        return
      }
      if (mounted) {
        setSessionUser({ id: session.user.id, email: session.user.email ?? "" })
        setLoading(false)
        await Promise.all([fetchEvents(session.user.id), fetchClients(session.user.id)])
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!session && mounted) return router.push("/login")
      if (session && mounted) {
        setSessionUser({ id: session.user.id, email: session.user.email ?? "" })
        setLoading(false)
        fetchEvents(session.user.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, fetchEvents, fetchClients])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openNewEvent = useCallback(() => {
    setSelectedEventId(null)
    setForm(EMPTY_FORM)
    setPanelOpen(true)
  }, [])

  const openEditEvent = useCallback((event: CalendarEvent) => {
    const originalEvent = events.find(e => e.id === event.id) || event

    setSelectedEventId(originalEvent.id)
    setForm({
      title: originalEvent.title,
      start: originalEvent.start,
      end: originalEvent.end,
      startTime: moment(originalEvent.start).format("HH:mm"),
      endTime: moment(originalEvent.end).format("HH:mm"),
      allDay: originalEvent.allDay || false,
      status: originalEvent.status,
      color: originalEvent.color,
      clientIds: originalEvent.clientIds || [],
      link: originalEvent.link || "",
    })
    setPanelOpen(true)
  }, [events])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setTimeout(() => {
      setSelectedEventId(null)
      setForm(EMPTY_FORM)
    }, 220)
  }, [])

  const handleFormChange = useCallback( 
    <K extends keyof FormState>(field: K, value: FormState[K]) => { 
      setForm(prev => ({ ...prev, [field]: value })) 
    }, 
    [] 
  ) 

  const handleLogout = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
  }, [])

  const handleToggleStatus = useCallback((id: string) => { 
    void toggleStatus(id)
  }, [toggleStatus]) 

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEventId) return
    setIsDeleting(true)
    try {
      const success = await deleteEvent(selectedEventId)
      if (success) {
        toast.success("Evento excluído")
        closePanel()
      }
    } finally {
      setIsDeleting(false)
    }
  }, [selectedEventId, closePanel, deleteEvent])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionUser) {
      toast.error("Sessão expirada. Faça login novamente.")
      return
    }
    
    setIsSubmitting(true)
    const success = await saveEvent(form, sessionUser.id, selectedEventId)
    if (success) {
      toast.success(selectedEventId ? "Evento atualizado" : "Evento criado")
      closePanel()
    }
    setIsSubmitting(false)
  }, [form, selectedEventId, closePanel, saveEvent, sessionUser])

  // ── Navegação ──────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setCurrentDate((d) => {
      const m = moment(d)
      if (currentView === "month" || currentView === "agenda") return m.add(1, "months").toDate()
      if (currentView === "week") return m.add(1, "weeks").toDate()
      return m.add(1, "days").toDate()
    })
  }, [currentView])
 
  const handlePrev = useCallback(() => {
    setCurrentDate((d) => {
      const m = moment(d)
      if (currentView === "month" || currentView === "agenda") return m.subtract(1, "months").toDate()
      if (currentView === "week") return m.subtract(1, "weeks").toDate()
      return m.subtract(1, "days").toDate()
    })
  }, [currentView])
 
  const handleToday = useCallback(() => setCurrentDate(new Date()), [])
 
  // ── Memo ───────────────────────────────────────────────────────────────────
 
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    return {
      style: { backgroundColor: event.color, borderColor: "transparent" },
    }
  }, [])
 
  const isToday = moment(currentDate).isSame(moment(), 'day')
 
  const calendarLabel = useMemo(() => {
    const m = moment(currentDate)
    if (currentView === "day") return m.format("dddd, D [de] MMMM")
    if (currentView === "week") {
      const weekStart = m.clone().startOf("week")
      return weekStart.format("MMMM YYYY")
    }
    return m.format("MMMM YYYY")
  }, [currentDate, currentView])

  const calendarMessages = useMemo(() => ({
    noEventsInRange: t("calendar.noEventsInRange"),
    showMore: (total: number) => t("calendar.showMore", { count: total }),
    allDay: t("calendar.allDay"),
    previous: t("calendar.previous"),
    next: t("calendar.next"),
    today: t("calendar.today"),
    month: t("calendar.month"),
    week: t("calendar.week"),
    day: t("calendar.day"),
    agenda: t("calendar.agenda"),
    date: t("calendar.date"),
    time: t("calendar.time"),
    event: t("calendar.event"),
  }), [t])

  const calendarComponents = useMemo(() => ({
    toolbar: () => null,
    event: CustomEvent,
  }), [])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-none grid grid-cols-1 gap-y-3 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-y-2">

        {/* Logo + label */} 
        <div className="flex flex-wrap items-center gap-2 min-w-0 justify-self-start"> 
 
          {/* Ícone da Diária */} 
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0"> 
            <rect width="32" height="32" rx="8" fill="#534AB7"/> 
            <rect x="8" y="10" width="16" height="14" rx="2.5" fill="none" stroke="white" strokeWidth="1.5"/> 
            <line x1="8" y1="14.5" x2="24" y2="14.5" stroke="white" strokeWidth="1.5"/> 
            <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
            <line x1="20" y1="8" x2="20" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
            <rect x="11.5" y="17.5" width="3" height="3" rx="0.75" fill="white"/> 
            <rect x="17.5" y="17.5" width="3" height="3" rx="0.75" fill="white" opacity="0.5"/> 
          </svg> 
 
          {/* Nome fixo + label de mês */} 
          <span className="text-sm font-semibold tracking-tight text-foreground">{t("calendar.daily")}</span> 
          <span
            className="hidden max-w-[11rem] truncate text-sm font-normal capitalize text-muted-foreground sm:block md:max-w-[14rem] lg:max-w-[18rem]"
            title={calendarLabel}
          >
            {calendarLabel}
          </span>
 
          {isToday && ( 
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"> 
              {t("calendar.today")} 
            </span> 
          )} 
        </div> 

        {/* Centro: largura fixa para não “pular” quando o mês (na esquerda) muda de tamanho */}
        <div className="flex w-full max-w-[28rem] shrink-0 flex-wrap items-center justify-center justify-self-center gap-x-2 gap-y-2 sm:gap-x-3">
          {/* Navegação */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={handleToday}
              className="text-xs px-3 py-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
            >
              {t("calendar.today")}
            </button>
            <div className="flex items-center">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-border/50" />

          {/* Seletor de view */}
          <div className="flex flex-wrap items-center justify-center bg-secondary/30 rounded-lg p-1 gap-0.5 max-w-full">
            {VIEWS.map(({ key, labelKey }) => (
              <button
                key={key}
                onClick={() => setCurrentView(key)}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-md transition-all font-medium cursor-pointer shrink-0 ${
                  currentView === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Ações direitas */}
        <div className="flex flex-wrap items-center justify-end justify-self-end gap-2">
          <button
            onClick={openNewEvent}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{t("calendar.newEvent")}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="rounded-lg border border-border/30 p-1.5 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer"
            title={t("calendar.clients")}
          >
            <Users className="size-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors border border-border/30 cursor-pointer">
                <UserIcon className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl mt-2">
              <DropdownMenuLabel className="font-normal py-2">
                <p className="text-xs font-medium">{t("calendar.account")}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{sessionUser?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="cursor-pointer gap-2 text-sm"
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === "dark" ? t("calendar.lightMode") : t("calendar.darkMode")}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="flex w-full cursor-default flex-row items-center justify-between gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <span className="text-sm text-muted-foreground">{t("calendar.textSize")}</span>
                <div
                  className="flex items-center gap-1"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      changeFont(-1)
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground cursor-pointer"
                  >
                    A<sup className="text-[7px]">−</sup>
                  </button>
                  <span className="min-w-[2.25rem] text-center text-xs text-muted-foreground">{fontLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      changeFont(1)
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground cursor-pointer"
                  >
                    A<sup className="text-[7px]">+</sup>
                  </button>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/8"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("calendar.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CalendarWorkArea
        currentView={currentView}
        events={events}
        displayEvents={displayEvents}
        currentDate={currentDate}
        setCurrentView={setCurrentView}
        setCurrentDate={setCurrentDate}
        openEditEvent={openEditEvent}
        onToggleStatus={handleToggleStatus}
        onNavigate={setCurrentDate}
        eventPropGetter={eventPropGetter}
        calendarComponents={calendarComponents}
        calendarMessages={calendarMessages}
        clients={clients}
        togglingIds={togglingIds}
      />

      {/* ── Slide-over ── */}
      <EventSlideOver
        open={panelOpen}
        form={form}
        selectedEventId={selectedEventId}
        isSubmitting={isSubmitting}
        isDeleting={isDeleting}
        clients={clients}
        onClose={closePanel}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}