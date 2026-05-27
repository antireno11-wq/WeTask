"use client";

import { MatchProfessional, Service, Slot } from "../types";

const DIETARY_OPTIONS = [
  "Sin gluten",
  "Sin lactosa",
  "APLV",
  "Vegetariana",
  "Vegana",
  "Sin frutos secos",
  "Otra alergia o indicación"
] as const;

type BookingScheduleStepProps = {
  selectedPro: MatchProfessional;
  selectedService: Service | null;
  todayKey: string;
  selectedDateKey: string;
  selectedMonthLabel: string;
  selectedDayLabel: string;
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  selectedSlotId: string;
  setSelectedSlotId: (id: string) => void;
  selectedStartAt: string;
  setSelectedStartAt: (startAt: string) => void;
  hours: number;
  setHours: (hours: number) => void;
  details: string;
  setDetails: (details: string) => void;
  isChefService: boolean;
  dietaryFlags: string[];
  setDietaryFlags: React.Dispatch<React.SetStateAction<string[]>>;
  dietaryNotes: string;
  setDietaryNotes: (notes: string) => void;
  todaySlots: Slot[];
  daysWithSlotsCount: number;
  nextAvailableSlot: Slot | null;
  monthCalendarDays: Array<{ key: string; date: Date; isCurrentMonth: boolean }>;
  slotsByDay: Map<string, Slot[]>;
  selectedSlots: Slot[];
  startOptions: string[];
  hourOptions: number[];
  recommendedHours: number | null;
  estimatedHoursRange: string;
  baseHourly: number;
  total: number;
  clp: (value: number) => string;
  formatBookingDateTime: (value: string) => string;
  shiftMonthKey: (dayKey: string, delta: number) => string;
  clampBookingHours: (value: number) => number;
  setBookingStage: (stage: "agenda" | "checkout") => void;
  selectedSlot: Slot | null;
};

export default function BookingScheduleStep({
  selectedPro,
  selectedService,
  todayKey,
  selectedDateKey,
  selectedMonthLabel,
  selectedDayLabel,
  selectedDay,
  setSelectedDay,
  selectedSlotId,
  setSelectedSlotId,
  selectedStartAt,
  setSelectedStartAt,
  hours,
  setHours,
  details,
  setDetails,
  isChefService,
  dietaryFlags,
  setDietaryFlags,
  dietaryNotes,
  setDietaryNotes,
  todaySlots,
  daysWithSlotsCount,
  nextAvailableSlot,
  monthCalendarDays,
  slotsByDay,
  selectedSlots,
  startOptions,
  hourOptions,
  recommendedHours,
  estimatedHoursRange,
  baseHourly,
  total,
  clp,
  formatBookingDateTime,
  shiftMonthKey,
  clampBookingHours,
  setBookingStage,
  selectedSlot
}: BookingScheduleStepProps) {
  return (
    <section className="auth-flow-panel client-dashboard-section booking-agenda-section">
      <div className="panel-head auth-flow-panel-head">
        <h2>Agenda y detalles de la reserva</h2>
        <p>Selecciona un día, luego elige el bloque, la hora de inicio y la cantidad de horas del servicio.</p>
      </div>

      <div className="booking-agenda-shell">
        <div className="booking-agenda-overview">
          <article className="availability-stat-card tone-indigo">
            <span>Hoy</span>
            <strong>{todaySlots.length}</strong>
            <p>bloque(s) abiertos hoy</p>
          </article>
          <article className="availability-stat-card tone-peach">
            <span>Disponibles</span>
            <strong>{selectedPro.slots.length}</strong>
            <p>horarios visibles para reservar</p>
          </article>
          <article className="availability-stat-card tone-sky">
            <span>Días activos</span>
            <strong>{daysWithSlotsCount}</strong>
            <p>días con agenda cargada</p>
          </article>
          <article className="availability-stat-card tone-mint">
            <span>Próximo</span>
            <strong>
              {nextAvailableSlot
                ? new Date(nextAvailableSlot.startsAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })
                : "--"}
            </strong>
            <p>
              {nextAvailableSlot
                ? new Date(nextAvailableSlot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                : "Sin bloques cercanos"}
            </p>
          </article>
        </div>

        <div className="availability-board-card booking-availability-board">
          <div className="availability-board-head">
            <div>
              <p className="availability-eyebrow">Calendario</p>
              <h3>{selectedMonthLabel}</h3>
            </div>
            <div className="availability-month-nav">
              <button
                type="button"
                className="availability-month-nav-btn"
                onClick={() => {
                  const next = shiftMonthKey(selectedDateKey, -1);
                  setSelectedDay(next);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="availability-month-nav-btn"
                onClick={() => {
                  const next = shiftMonthKey(selectedDateKey, 1);
                  setSelectedDay(next);
                }}
              >
                ›
              </button>
            </div>
          </div>

          <div className="availability-weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="availability-month-grid">
            {monthCalendarDays.map((day) => {
              const slotCount = slotsByDay.get(day.key)?.length ?? 0;
              const isToday = day.key === todayKey;
              const isSelected = day.key === selectedDay;

              return (
                <button
                  key={day.key}
                  type="button"
                  className={[
                    "availability-day-card",
                    !day.isCurrentMonth ? "muted" : "",
                    isToday ? "today" : "",
                    isSelected ? "selected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setSelectedDay(day.key);
                    setSelectedSlotId("");
                    setSelectedStartAt("");
                  }}
                >
                  <span className="availability-day-number">{day.date.getDate()}</span>
                  <span className="availability-day-meta">{slotCount > 0 ? `${slotCount} horario(s)` : "Sin horarios"}</span>
                  <span className="availability-day-dots" aria-hidden>
                    {slotCount > 0 ? <span className="availability-dot free" /> : <span className="availability-dot" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="availability-task-panel booking-availability-task-panel">
          <div className="availability-task-head">
            <div>
              <p className="availability-eyebrow">Día elegido</p>
              <h4>{selectedDayLabel}</h4>
            </div>
            <span className="availability-selected-pill">{selectedSlots.length} bloque(s)</span>
          </div>

          {selectedSlots.length === 0 ? (
            <div className="availability-empty-state">
              <strong>No hay horarios abiertos ese día.</strong>
              <p>Prueba con otro día del calendario para ver la disponibilidad de este tasker.</p>
            </div>
          ) : (
            <div className="availability-task-list">
              {selectedSlots.map((slot) => (
                <article
                  key={slot.id}
                  className={`availability-task-item open booking-availability-task-item ${
                    selectedSlotId === slot.id ? "is-selected" : ""
                  }`}
                >
                  <div className="availability-task-time">
                    {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    <span />
                    {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="availability-task-copy">
                    <strong>{slot.service?.name ?? selectedService?.name ?? "Bloque disponible"}</strong>
                    <p>Primero elige este bloque base y luego define tu hora de inicio y duración.</p>
                  </div>
                  <div className="availability-task-actions">
                    <button
                      type="button"
                      className="cta small"
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        setSelectedStartAt(new Date(slot.startsAt).toISOString());
                      }}
                    >
                      {selectedSlotId === slot.id ? "Bloque elegido" : "Usar este bloque"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="booking-agenda-detail-card">
          <div className="grid-form auth-flow-form booking-agenda-form">
            <label>
              Hora de inicio
              <select value={selectedStartAt} onChange={(e) => setSelectedStartAt(e.target.value)} disabled={!selectedSlot}>
                {!selectedSlot ? <option value="">Primero elige un bloque</option> : null}
                {startOptions.map((startAt) => (
                  <option key={startAt} value={startAt}>
                    {new Date(startAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Horas del servicio
              <select
                value={hours}
                onChange={(e) => setHours(clampBookingHours(Number(e.target.value) || 1))}
                disabled={!selectedSlot}
              >
                {hourOptions.map((hourOption) => (
                  <option key={hourOption} value={hourOption}>
                    {hourOption} hora{hourOption === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
              {recommendedHours ? (
                <small className="input-hint">
                  Recomendación WeTask: {estimatedHoursRange ? `${estimatedHoursRange} · ` : ""}
                  reserva sugerida {recommendedHours} hora(s).
                </small>
              ) : null}
            </label>
            <label className="full">
              Detalles del trabajo
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} />
            </label>
            {isChefService ? (
              <div className="full auth-flow-note-card">
                <strong>¿Deberíamos saber algo sobre tu alimentación?</strong>
                <span>Cuéntanos si necesitas comida libre de alérgenos, sin gluten, APLV u otra consideración importante.</span>
                <div className="inline-checks" style={{ marginTop: 12 }}>
                  {DIETARY_OPTIONS.map((option) => (
                    <label key={option}>
                      <input
                        type="checkbox"
                        checked={dietaryFlags.includes(option)}
                        onChange={(event) =>
                          setDietaryFlags((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, option]))
                              : current.filter((item) => item !== option)
                          )
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
                <textarea
                  style={{ marginTop: 12 }}
                  value={dietaryNotes}
                  onChange={(event) => setDietaryNotes(event.target.value)}
                  placeholder="Ejemplo: una persona es celíaca, evitar contaminación cruzada, sin mariscos, menú infantil, etc."
                />
              </div>
            ) : null}
          </div>

          <div className="price-box booking-price-box">
            <div className="booking-price-box-head">
              <strong>Total estimado de la reserva</strong>
              <span>{clp(total)}</span>
            </div>
            <p>Tarifa referencial del tasker: {clp(baseHourly)}/h</p>
            {selectedSlot && selectedStartAt ? (
              <p>
                Horario elegido: <strong>{formatBookingDateTime(selectedStartAt)}</strong> · duración{" "}
                <strong>{hours} hora(s)</strong>
              </p>
            ) : (
              <p>Elige un bloque, la hora de inicio y cuántas horas necesitas para continuar.</p>
            )}
            {recommendedHours ? (
              <p>
                Tiempo recomendado: <strong>{recommendedHours} hora(s)</strong>
                {estimatedHoursRange ? ` · Rango estimado ${estimatedHoursRange}` : ""}
              </p>
            ) : null}
          </div>

          <div className="cta-row">
            <button
              className="cta"
              type="button"
              disabled={!selectedSlot || !selectedStartAt}
              onClick={() => setBookingStage("checkout")}
            >
              Continuar al checkout
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
