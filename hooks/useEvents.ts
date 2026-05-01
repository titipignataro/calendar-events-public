import { useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import moment from "moment-timezone"
import { toast } from "sonner"

// ─── Constants ────────────────────────────────────────────────────────────────

const TZ = "America/Sao_Paulo"
const DEFAULT_COLOR = '#534AB7'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  status: 'pending' | 'done'
  color: string
  clientIds: string[]
  link?: string
}

type DbEvent = { 
  id: string 
  title: string 
  start_time: string 
  end_time: string 
  all_day?: boolean 
  status?: 'pending' | 'done' 
  color?: string 
  event_clients?: { client_id: string }[]
  link?: string
}

export type FormState = {
  title: string
  start: Date | null
  end: Date | null
  startTime: string
  endTime: string
  allDay: boolean
  status: 'pending' | 'done'
  color: string
  clientIds: string[]
  link?: string
}

// ─── Pure Helpers (Outside Hook) ──────────────────────────────────────────────

function mapDbEvent(item: DbEvent): CalendarEvent { 
  return { 
    id: item.id, 
    title: item.title, 
    start: moment.tz(item.start_time, TZ).toDate(), 
    end:   moment.tz(item.end_time,   TZ).toDate(), 
    allDay: item.all_day || false, 
    status: item.status ?? 'pending', 
    color:  item.color  ?? DEFAULT_COLOR, 
    clientIds: item.event_clients?.map(ec => ec.client_id) || [],
    link: item.link
  } 
} 

function buildDateTime(date: Date, time: string): Date { 
  const dateStr = moment(date).format("YYYY-MM-DD") 
  const timeStr = time || "12:00" 
  return moment.tz(`${dateStr}T${timeStr}`, TZ).toDate() 
} 

function applyAllDayRange(start: Date, end: Date): void { 
  start.setHours(0, 0, 0, 0) 
  end.setHours(23, 59, 59, 999) 
} 

function validateEventForm(title: string, start: Date | null, end: Date | null): void { 
  if (!title.trim()) throw new Error("Informe o título do evento") 
  if (!start) throw new Error("Informe a data de início") 
  if (!end) throw new Error("Informe a data de fim") 
} 

async function upsertEvent(params: { 
  selectedEventId: string | null 
  payload: { 
    title: string 
    start_time: string 
    end_time: string 
    user_id: string 
    all_day: boolean 
    status: 'pending' | 'done' 
    color: string 
    link?: string 
  } 
}): Promise<DbEvent> { 
  const { selectedEventId, payload } = params 
  
  if (selectedEventId) { 
    const { data, error } = await supabase 
      .from("events") 
      .update(payload) 
      .eq("id", selectedEventId) 
      .select() 
      .single() 
    
    if (error) throw new Error(`Erro ao atualizar: ${error.message}`) 
    return data as DbEvent 
  } 
  
  const { data, error } = await supabase 
    .from("events") 
    .insert(payload) 
    .select() 
    .single() 
  
  if (error) throw new Error(`Erro ao criar: ${error.message}`) 
  return data as DbEvent 
} 

async function syncEventClients(params: { 
  eventId: string 
  clientIds: string[] 
  isUpdate: boolean 
}): Promise<void> { 
  const { eventId, clientIds, isUpdate } = params 
  
  if (isUpdate) { 
    const { error } = await supabase 
      .from("event_clients") 
      .delete() 
      .eq("event_id", eventId) 
    
    if (error) throw new Error(`Erro ao limpar relações: ${error.message}`) 
  } 
  
  if (clientIds.length === 0) return 
  
  const links = clientIds.map(clientId => ({ 
    event_id: eventId, 
    client_id: clientId, 
  })) 
  
  const { error } = await supabase 
    .from("event_clients") 
    .insert(links) 
  
  if (error) throw new Error(`Erro ao inserir relações: ${error.message}`) 
} 

async function fetchEventWithClients(eventId: string): Promise<DbEvent> { 
  const { data, error } = await supabase 
    .from("events") 
    .select("*, event_clients(client_id)") 
    .eq("id", eventId) 
    .single() 
  
  if (error) throw new Error(`Erro ao buscar evento: ${error.message}`) 
  return data as DbEvent 
} 

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])

  const fetchEvents = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select('*, event_clients(client_id)')
        .eq("user_id", userId)
        .order("start_time", { ascending: true })

      if (error) {
        toast.error("Erro ao carregar eventos")
        return
      }

      setEvents((data as DbEvent[]).map(mapDbEvent))
    } catch (err) {
      console.error(err)
      toast.error("Erro inesperado ao carregar eventos")
    }
  }, [])

  const pendingRequests = useRef(new Map<string, number>())
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const toggleStatus = useCallback(async (id: string) => {
    // 1. Snapshot do estado atual (Leitura fora do setter)
    const target = events.find(e => e.id === id)
    if (!target) return

    const previousStatus = target.status
    const nextStatus = target.status === 'done' ? 'pending' : 'done'

    // 2. Controle de versão e UX
    const nextVersion = (pendingRequests.current.get(id) || 0) + 1
    pendingRequests.current.set(id, nextVersion)
    setTogglingIds(prev => new Set(prev).add(id))

    // 3. Update Otimista
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, status: nextStatus } : e)))

    try {
      // 4. Efeito Colateral com CAS (Compare-and-Swap)
      const { error, data } = await supabase
        .from("events")
        .update({ status: nextStatus })
        .eq("id", id)
        .eq("status", previousStatus) // Garante que não sobrescrevemos mudanças externas
        .select()

      // Se o data vier vazio, significa que o .eq("status", previousStatus) falhou (conflito)
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error("Conflito: o evento foi alterado por outro usuário ou dispositivo.")
      }
    } catch (err) {
      // 5. Rollback Seguro (Apenas se for a intenção mais recente)
      if (pendingRequests.current.get(id) === nextVersion) {
        const message = err instanceof Error ? err.message : "Erro ao atualizar status"
        toast.error(message)
        setEvents(current =>
          current.map(e => (e.id === id ? { ...e, status: previousStatus } : e))
        )
      }
    } finally {
      // 6. Cleanup de versão e estado de UI
      if (pendingRequests.current.get(id) === nextVersion) {
        pendingRequests.current.delete(id)
        setTogglingIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        // Request antiga -> ignora sem tocar no map ou no estado de UI
      }
    }
  }, [events])

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("events").delete().eq("id", id)
      if (error) throw error
      setEvents(prev => prev.filter(e => e.id !== id))
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao excluir evento"
      toast.error(message)
      return false
    }
  }, [])

  const saveEvent = useCallback(async (
    form: FormState, 
    userId: string, 
    selectedEventId: string | null
  ): Promise<boolean> => {
    try {
      const { title, start, end, startTime, endTime, color, status, allDay, clientIds, link } = form

      // 1. Validar form
      validateEventForm(title, start, end)

      // 2. Construir datas
      const parsedStart = buildDateTime(start!, startTime)
      const parsedEnd = buildDateTime(end!, endTime)

      // 3. Aplicar all-day se necessário
      if (allDay) {
        applyAllDayRange(parsedStart, parsedEnd)
      }

      // 4. Validar que start < end
      if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) throw new Error("Datas inválidas")
      if (parsedStart >= parsedEnd) throw new Error("O fim deve ser posterior ao início")

      // 5. Montar payload
      const payload = {
        title: title.trim(),
        start_time: moment(parsedStart).toISOString(),
        end_time: moment(parsedEnd).toISOString(),
        user_id: userId,
        all_day: allDay,
        status: status,
        color: color || DEFAULT_COLOR,
        link: link?.trim()
      }

      // 6. upsertEvent
      const dbResult = await upsertEvent({ selectedEventId, payload })

      // 7. syncEventClients
      await syncEventClients({ 
        eventId: dbResult.id, 
        clientIds, 
        isUpdate: !!selectedEventId 
      })

      // 8. fetchEventWithClients
      const updatedDbEvent = await fetchEventWithClients(dbResult.id)

      // 9. Mapear com mapDbEvent
      const newEvent = mapDbEvent(updatedDbEvent)

      // 10. Atualizar state com setEvents
      setEvents((prev) =>
        selectedEventId
          ? prev.map((e) => (e.id === selectedEventId ? newEvent : e))
          : [...prev, newEvent]
      )

      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar evento"
      toast.error(message)
      return false
    }
  }, [])

  return {
    events,
    setEvents,
    fetchEvents,
    toggleStatus,
    togglingIds,
    deleteEvent,
    saveEvent
  }
}
