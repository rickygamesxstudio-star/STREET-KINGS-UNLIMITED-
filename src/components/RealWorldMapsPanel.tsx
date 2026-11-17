/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface GroundingLink {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

interface SelectedPlaceInfo {
  name: string;
  address: string;
  location: google.maps.LatLngLiteral;
  placeId?: string;
}

const CRUISE_HUBS: Array<{ label: string; center: google.maps.LatLngLiteral }> = [
  { label: 'Kingston / Knutsford', center: { lat: 18.0061, lng: -76.7885 } },
  { label: 'Montego Bay', center: { lat: 18.4762, lng: -77.8939 } },
  { label: 'Ocho Rios', center: { lat: 18.4074, lng: -77.1031 } },
  { label: 'Negril Seven Mile', center: { lat: 18.2789, lng: -78.3489 } },
];

function checkQuotaError(err: unknown): boolean {
  const txt = String(err || '');
  return (
    txt.includes('OVER_QUERY_LIMIT') ||
    txt.includes('RESOURCE_EXHAUSTED') ||
    txt.includes('429') ||
    txt.includes('Quota')
  );
}

interface InnerMapsContentProps {
  origin: google.maps.LatLngLiteral;
  selectedPlace: SelectedPlaceInfo | null;
  onSelectPlace: (place: SelectedPlaceInfo) => void;
  onCenterChange: (center: google.maps.LatLngLiteral) => void;
  onOriginChange: (loc: google.maps.LatLngLiteral) => void;
}

const AutocompleteSearchBox: React.FC<{
  biasCenter: google.maps.LatLngLiteral;
  onPlaceChosen: (place: SelectedPlaceInfo) => void;
}> = ({ biasCenter, onPlaceChosen }) => {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const voice = useVoiceRecorder(
    useCallback((text: string) => {
      setQuery(text);
    }, [])
  );

  useEffect(() => {
    if (!placesLib || !query.trim()) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        setLoading(true);
        setPlaceErr(null);
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          sessionToken: sessionTokenRef.current,
          locationBias: {
            center: biasCenter,
            radius: 25000,
          },
        });
        if (!cancelled) {
          setSuggestions(res.suggestions || []);
        }
      } catch (err) {
        if (checkQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setPlaceErr('Unable to load place suggestions right now.');
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, query, biasCenter]);

  const handlePickSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport', 'id'],
      });
      if (place.location) {
        const loc: google.maps.LatLngLiteral = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        onPlaceChosen({
          name: place.displayName || suggestion.placePrediction.text.text || 'Destination',
          address: place.formattedAddress || '',
          location: loc,
          placeId: place.id,
        });
        if (map) {
          if (place.viewport) map.fitBounds(place.viewport);
          else {
            map.panTo(loc);
            map.setZoom(14);
          }
        }
      }
      sessionTokenRef.current = null;
      setSuggestions([]);
      setQuery('');
    } catch (err) {
      if (checkQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setPlaceErr('Unable to load selected place details.');
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search real-world streets, tracks, landmarks..."
            className="w-full rounded-xl border border-white/15 bg-zinc-900 pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={voice.isRecording ? voice.stopRecording : voice.startRecording}
          disabled={voice.isTranscribing}
          title={voice.isRecording ? 'Stop Voice Search' : 'Voice Search (Gemini Transcribe)'}
          className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer ${
            voice.isRecording
              ? 'border-red-400 bg-red-500/20 text-red-300'
              : 'border-white/15 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          {voice.isTranscribing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : voice.isRecording ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-cyan-400" />
          )}
          <span className="hidden sm:inline">
            {voice.isRecording ? 'Stop' : voice.isTranscribing ? '...' : 'Speak'}
          </span>
        </button>
      </div>

      {(placeErr || voice.error) && (
        <div className="mt-1 text-[11px] text-red-400">{placeErr || voice.error}</div>
      )}

      {(suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl">
          {loading && (
            <div className="px-3 py-2 text-xs text-zinc-400 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching Places API...
            </div>
          )}
          {suggestions.map((s, idx) => (
            <button
              key={s.placePrediction?.placeId || idx}
              type="button"
              onClick={() => handlePickSuggestion(s)}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-200 hover:bg-white/10 cursor-pointer"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate">{s.placePrediction?.text.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const RouteLayer: React.FC<{
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral | null;
  onRouteSummary: (summary: { distanceText: string; durationText: string } | null) => void;
}> = ({ origin, destination, onRouteSummary }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routesLib || !map || !destination) {
      onRouteSummary(null);
      setRouteError(null);
      return;
    }

    let cancelled = false;
    const travelMode = routesLib.TravelMode.DRIVING;

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode,
      fields: ['durationMillis', 'distanceMeters', 'path', 'viewport'],
    })
      .then((res) => {
        if (cancelled) return;
        const firstRoute = res.routes?.[0];
        if (!firstRoute) {
          setRouteError('No driving route found between these coordinates.');
          onRouteSummary(null);
          return;
        }
        setRouteError(null);

        const createdPolylines = firstRoute.createPolylines({
          polylineOptions: {
            strokeColor: '#06b6d4',
            strokeOpacity: 0.95,
            strokeWeight: 5,
          },
        });
        createdPolylines.forEach((p) => p.setMap(map));
        polylinesRef.current = createdPolylines;

        if (firstRoute.viewport) {
          map.fitBounds(firstRoute.viewport);
        }

        const distKm =
          typeof firstRoute.distanceMeters === 'number'
            ? `${(firstRoute.distanceMeters / 1000).toFixed(1)} km`
            : 'Route Ready';
        const durText =
          typeof firstRoute.durationMillis === 'number'
            ? `${Math.max(1, Math.round(firstRoute.durationMillis / 60000))} min`
            : '';
        onRouteSummary({ distanceText: distKm, durationText: durText });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (checkQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setRouteError('Unable to compute driving route. Check quota or network.');
        onRouteSummary(null);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, destination, onRouteSummary]);

  if (!routeError) return null;
  return (
    <div className="mt-1.5 text-[11px] text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-lg px-2.5 py-1">
      {routeError}
    </div>
  );
};

const InnerMapViewport: React.FC<InnerMapsContentProps> = ({
  origin,
  selectedPlace,
  onSelectPlace,
  onCenterChange,
  onOriginChange,
}) => {
  const loadingStatus = useApiLoadingStatus();
  const map = useMap();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const [routeSummary, setRouteSummary] = useState<{
    distanceText: string;
    durationText: string;
  } | null>(null);

  useEffect(() => {
    if (selectedPlace) setInfoOpen(true);
  }, [selectedPlace]);

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.AUTH_FAILURE ||
      loadingStatus === APILoadingStatus.FAILED
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [loadingStatus]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CRUISE_HUBS.map((hub) => (
            <button
              key={hub.label}
              type="button"
              onClick={() => {
                onOriginChange(hub.center);
                onCenterChange(hub.center);
                map?.panTo(hub.center);
                map?.setZoom(13);
              }}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            >
              {hub.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                onOriginChange(coords);
                onCenterChange(coords);
                map?.panTo(coords);
                map?.setZoom(13);
              },
              () => {
                // Keep default hub on permission denial
              }
            );
          }}
          className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
        >
          <Compass className="h-3.5 w-3.5" /> My GPS
        </button>
      </div>

      <AutocompleteSearchBox biasCenter={origin} onPlaceChosen={onSelectPlace} />

      <div className="relative h-[380px] sm:h-[430px] w-full overflow-hidden rounded-xl border border-white/15 bg-zinc-900">
        {loadingStatus === APILoadingStatus.AUTH_FAILURE ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-zinc-400">
            <p className="font-semibold text-amber-300">Google Maps Platform could not authorize right now.</p>
            <p className="mt-1">Check quota status or retry after updating your Maps settings.</p>
          </div>
        ) : (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={origin}
            defaultZoom={12}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onCameraChanged={(ev) => {
              onCenterChange(ev.detail.center);
            }}
            onClick={(ev) => {
              if (!ev.detail.latLng) return;
              onSelectPlace({
                name: 'Pinned Destination',
                address: `${ev.detail.latLng.lat.toFixed(5)}, ${ev.detail.latLng.lng.toFixed(5)}`,
                location: ev.detail.latLng,
              });
            }}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Origin / Driver Start Pin */}
            <AdvancedMarker position={origin} title="Driver Start Origin">
              <Pin background="#06b6d4" borderColor="#083344" glyphColor="#09090b" />
            </AdvancedMarker>

            {/* Destination Pin + InfoWindow */}
            {selectedPlace && (
              <>
                <AdvancedMarker
                  ref={markerRef}
                  position={selectedPlace.location}
                  title={selectedPlace.name}
                  onClick={() => setInfoOpen(true)}
                >
                  <Pin background="#f59e0b" borderColor="#451a03" glyphColor="#09090b" scale={1.15} />
                </AdvancedMarker>
                {infoOpen && marker && (
                  <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
                    <div className="text-zinc-900 p-0.5 max-w-[210px]">
                      <div className="font-bold text-xs">{selectedPlace.name}</div>
                      {selectedPlace.address && (
                        <div className="text-[11px] text-zinc-600 mt-0.5">{selectedPlace.address}</div>
                      )}
                      {routeSummary && (
                        <div className="text-[11px] font-semibold text-cyan-700 mt-1">
                          Drive: {routeSummary.distanceText}
                          {routeSummary.durationText ? ` · ${routeSummary.durationText}` : ''}
                        </div>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </>
            )}
          </GoogleMap>
        )}
      </div>

      <RouteLayer
        origin={origin}
        destination={selectedPlace ? selectedPlace.location : null}
        onRouteSummary={setRouteSummary}
      />

      {routeSummary && selectedPlace && (
        <div className="flex items-center justify-between rounded-xl border border-cyan-500/35 bg-cyan-950/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-cyan-200 font-medium">
            <Navigation className="h-4 w-4 text-cyan-400" />
            <span>Route to {selectedPlace.name}</span>
          </div>
          <span className="font-telemetry font-bold text-white">
            {routeSummary.distanceText}
            {routeSummary.durationText ? ` (${routeSummary.durationText})` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export const RealWorldMapsPanel: React.FC = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [origin, setOrigin] = useState<google.maps.LatLngLiteral>(CRUISE_HUBS[0].center);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(CRUISE_HUBS[0].center);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceInfo | null>(null);

  // Google Maps Grounding (gemini-4-hydrogen + { googleMaps: {} })
  const [groundQuery, setGroundQuery] = useState('');
  const [groundLoading, setGroundLoading] = useState(false);
  const [groundText, setGroundText] = useState<string>('');
  const [groundLinks, setGroundLinks] = useState<GroundingLink[]>([]);
  const [groundError, setGroundError] = useState<string | null>(null);

  const groundVoice = useVoiceRecorder(
    useCallback((text: string) => {
      setGroundQuery(text);
    }, [])
  );

  const runMapsGrounding = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? groundQuery).trim();
    if (!q) return;
    setGroundLoading(true);
    setGroundError(null);
    try {
      const resp = await fetch('/api/gemini/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          location: mapCenter,
        }),
      });
      const data = (await resp.json()) as {
        text?: string;
        groundingLinks?: GroundingLink[];
        error?: string;
      };
      if (!resp.ok) {
        throw new Error(data.error || `Maps Grounding failed (HTTP ${resp.status}).`);
      }
      setGroundText(data.text || '');
      setGroundLinks(data.groundingLinks || []);
    } catch (err) {
      setGroundError(err instanceof Error ? err.message : 'Unable to query Maps Grounding.');
    } finally {
      setGroundLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div className="lg:col-span-7">
        {!apiKey ? (
          <div className="flex h-[380px] flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-zinc-900 p-6 text-center text-xs text-zinc-300">
            <p className="font-semibold text-amber-300">
              Google Maps JavaScript key (`VITE_GOOGLE_MAPS_API_KEY`) is not currently injected in this client build.
            </p>
            <p className="mt-1.5 text-zinc-400">
              You can still use the AI Maps Grounding Scout on the right to discover real-world locations and Google Maps links.
            </p>
          </div>
        ) : (
          <APIProvider
            apiKey={apiKey}
            libraries={['places', 'routes', 'marker']}
            language="en"
            region="JM"
          >
            <InnerMapViewport
              origin={origin}
              selectedPlace={selectedPlace}
              onSelectPlace={setSelectedPlace}
              onCenterChange={setMapCenter}
              onOriginChange={setOrigin}
            />
          </APIProvider>
        )}
      </div>

      {/* Right Column: Gemini Google Maps Grounding Explorer */}
      <div className="lg:col-span-5 flex flex-col rounded-xl border border-white/12 bg-zinc-900/75 p-4 space-y-3 h-[505px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold text-white">
              AI Maps Grounding Scout
            </h3>
          </div>
          <span className="text-[10px] font-telemetry text-cyan-400">
            gemini-4-hydrogen
          </span>
        </div>

        <p className="text-[11px] text-zinc-400">
          Ask about real-world Jamaican driving routes, beaches, jerk spots, or scenic overlooks near ({mapCenter.lat.toFixed(2)}, {mapCenter.lng.toFixed(2)}).
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runMapsGrounding();
          }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={groundQuery}
            onChange={(e) => setGroundQuery(e.target.value)}
            placeholder="Best scenic coastal drives or jerk spots in Jamaica..."
            className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={groundVoice.isRecording ? groundVoice.stopRecording : groundVoice.startRecording}
            disabled={groundVoice.isTranscribing}
            title="Speak query"
            className={`rounded-xl border px-2.5 py-2 cursor-pointer ${
              groundVoice.isRecording
                ? 'border-red-400 bg-red-500/20 text-red-300'
                : 'border-white/15 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {groundVoice.isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4 text-cyan-400" />
            )}
          </button>
          <button
            type="submit"
            disabled={groundLoading || !groundQuery.trim()}
            className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
          >
            {groundLoading ? 'Scouting...' : 'Scout'}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {[
            'Scenic Blue Mountains roads in Jamaica',
            'Famous Hellshire & Kingston coastal spots',
            'Best jerk & car hangout stops near Montego Bay',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setGroundQuery(preset);
                runMapsGrounding(preset);
              }}
              className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-300 hover:border-amber-400/50 cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {(groundError || groundVoice.error) && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {groundError || groundVoice.error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {!groundText && !groundLoading && groundLinks.length === 0 && (
            <div className="rounded-lg border border-white/5 bg-zinc-950/60 p-3 text-xs text-zinc-500">
              Grounded answers and verified Google Maps place links will appear here.
            </div>
          )}

          {groundText && (
            <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-3 text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap">
              {groundText}
            </div>
          )}

          {groundLinks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Verified Google Maps Links
              </div>
              {groundLinks.map((lnk, idx) => (
                <a
                  key={`${lnk.uri}_${idx}`}
                  href={lnk.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-cyan-500/30 bg-zinc-950 p-2.5 hover:border-cyan-400 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-cyan-300">
                    <span className="truncate">{lnk.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  {lnk.reviewSnippets && lnk.reviewSnippets[0] && (
                    <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">
                      “{lnk.reviewSnippets[0]}”
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
