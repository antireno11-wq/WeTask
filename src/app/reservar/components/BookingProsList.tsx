"use client";

import { MatchProfessional } from "../types";

type BookingProsListProps = {
  matches: MatchProfessional[];
  selectedProId: string;
  setSelectedProId: (id: string) => void;
  setTaskerFlowLocked: (val: boolean) => void;
  setBookingStage: (stage: "agenda" | "checkout") => void;
  setSelectedDay: (day: string) => void;
  setSelectedSlotId: (id: string) => void;
  setSelectedStartAt: (startAt: string) => void;
  starsText: (value: number) => string;
  clp: (value: number) => string;
  isoDay: (value: string) => string;
  loadingSearch: boolean;
};

export default function BookingProsList({
  matches,
  selectedProId,
  setSelectedProId,
  setTaskerFlowLocked,
  setBookingStage,
  setSelectedDay,
  setSelectedSlotId,
  setSelectedStartAt,
  starsText,
  clp,
  isoDay,
  loadingSearch
}: BookingProsListProps) {
  return (
    <section className="auth-flow-panel client-dashboard-section">
      <div className="panel-head auth-flow-panel-head">
        <h2>Profesionales disponibles</h2>
        <p>Ordenados por distancia, disponibilidad, valoración y precio estimado por hora.</p>
      </div>

      <div className="list booking-results-list">
        {matches.map((pro) => (
          <article className={`booking-card ${selectedProId === pro.userId ? "selected-pro" : ""}`} key={pro.id}>
            <div className="booking-head">
              <h3>{pro.fullName}</h3>
              <span className="status status-completed">{pro.distanceKm} km</span>
            </div>
            <p>
              <strong>Rating:</strong> {starsText(pro.ratingAvg)} {pro.ratingAvg.toFixed(1)} ({pro.ratingsCount})
            </p>
            <p>
              <strong>Precio/hora:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
            </p>
            <p>
              <strong>Próxima hora:</strong> {pro.nextAvailableAt ? new Date(pro.nextAvailableAt).toLocaleString("es-ES") : "Sin slots"}
            </p>
            <p>
              <strong>Cobertura:</strong> hasta {pro.serviceRadiusKm} km
            </p>
            <button
              className="cta small"
              type="button"
              onClick={() => {
                setSelectedProId(pro.userId);
                setTaskerFlowLocked(true);
                setBookingStage("agenda");
                const firstDay = isoDay(pro.slots[0]?.startsAt ?? "");
                setSelectedDay(firstDay);
                setSelectedSlotId("");
                setSelectedStartAt("");
              }}
            >
              Elegir profesional
            </button>
          </article>
        ))}
        {!loadingSearch && matches.length === 0 ? (
          <p className="empty">Aún no hay profesionales cargados para esta búsqueda.</p>
        ) : null}
      </div>
    </section>
  );
}
