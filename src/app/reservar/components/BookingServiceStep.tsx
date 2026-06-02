"use client";

import { FormEvent } from "react";
import { ACTIVE_MVP_COMMUNES } from "@/lib/communes";
import { Service, MatchProfessional } from "../types";

type AddressState = {
  city: string;
  commune: string;
  postalCode: string;
  street: string;
  latitude: string;
  longitude: string;
};

type FiltersState = {
  serviceId: string;
  date: string;
};

type BookingServiceStepProps = {
  address: AddressState;
  setAddress: React.Dispatch<React.SetStateAction<AddressState>>;
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  customerId: string;
  setCustomerId: (id: string) => void;
  services: Service[];
  loadingSearch: boolean;
  loadingServices: boolean;
  searchPros: (event: FormEvent) => void;
  useGeolocation: () => void;
  quickCheckoutMode: boolean;
  selectedPro: MatchProfessional | null;
  selectedService: Service | null;
  selectedStartAt: string;
  formatBookingDateTime: (value: string) => string;
  starsText: (value: number) => string;
  initials: (name: string) => string;
  setTaskerFlowLocked: (val: boolean) => void;
  setBookingStage: (stage: "agenda" | "checkout") => void;
};

export default function BookingServiceStep({
  address,
  setAddress,
  filters,
  setFilters,
  customerId,
  setCustomerId,
  services,
  loadingSearch,
  loadingServices,
  searchPros,
  useGeolocation,
  quickCheckoutMode,
  selectedPro,
  selectedService,
  selectedStartAt,
  formatBookingDateTime,
  starsText,
  initials,
  setTaskerFlowLocked,
  setBookingStage
}: BookingServiceStepProps) {
  if (quickCheckoutMode && selectedPro) {
    return (
      <section className="auth-flow-panel client-dashboard-section">
        <div className="panel-head auth-flow-panel-head">
          <h2>Tasker seleccionado</h2>
          <p>Ya elegiste un tasker. En este paso solo define la fecha, la hora de inicio y cuántas horas quieres reservar.</p>
        </div>

        <div className="booking-checkout-summary">
          <div className="booking-checkout-tasker-card">
            <div className="booking-checkout-tasker-avatar" aria-hidden>
              {selectedPro.profilePhotoUrl ? (
                <img src={selectedPro.profilePhotoUrl} alt="" className="booking-checkout-tasker-avatar-image" />
              ) : (
                initials(selectedPro.fullName)
              )}
            </div>
            <div className="booking-checkout-tasker-copy">
              <strong>{selectedPro.fullName}</strong>
              <span>
                {starsText(selectedPro.ratingAvg)} {Number(selectedPro.ratingAvg).toFixed(1)} ({selectedPro.ratingsCount})
              </span>
            </div>
          </div>
          <p>
            Servicio: <strong>{selectedService?.name ?? "Servicio seleccionado"}</strong>
          </p>
          <p>
            Fecha y hora: <strong>{selectedStartAt ? formatBookingDateTime(selectedStartAt) : "Selecciona bloque y hora"}</strong>
          </p>
          <p>
            Dirección: <strong>{address.street}, {address.commune}, {address.city}</strong>
          </p>
        </div>

        <div className="cta-row">
          <button
            className="cta ghost"
            type="button"
            onClick={() => {
              setTaskerFlowLocked(false);
              setBookingStage("agenda");
            }}
          >
            Editar búsqueda
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-flow-panel client-dashboard-section">
      <div className="panel-head auth-flow-panel-head">
        <h2>Busca tu servicio</h2>
        <p>Completa la ubicación, elige la fecha deseada y encuentra profesionales disponibles en tiempo real.</p>
      </div>

      <form className="grid-form auth-flow-form" onSubmit={searchPros}>
        <label>
          Ciudad
          <input
            value={address.city}
            onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
            required
          />
        </label>
        <label>
          Comuna
          <select
            value={address.commune}
            onChange={(e) => setAddress((prev) => ({ ...prev, commune: e.target.value }))}
            required
          >
            {ACTIVE_MVP_COMMUNES.map((commune) => (
              <option key={commune} value={commune}>
                {commune}
              </option>
            ))}
          </select>
        </label>
        <label>
          Código postal
          <input
            value={address.postalCode}
            onChange={(e) => setAddress((prev) => ({ ...prev, postalCode: e.target.value }))}
            required
          />
        </label>
        <label className="full">
          Calle
          <input
            value={address.street}
            onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
            required
          />
        </label>

        <label>
          Servicio
          <select
            value={filters.serviceId}
            onChange={(e) => setFilters((prev) => ({ ...prev, serviceId: e.target.value }))}
          >
            <option value="">Selecciona</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha deseada
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
          />
        </label>
        <label>
          ID cliente
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="cliente demo o real"
            required
          />
        </label>

        <div className="cta-row">
          <button className="cta ghost" type="button" onClick={useGeolocation}>
            Usar geolocalización
          </button>
          <button className="cta" type="submit" disabled={loadingSearch || loadingServices}>
            {loadingSearch ? "Buscando..." : "Buscar profesionales"}
          </button>
        </div>
      </form>
    </section>
  );
}
