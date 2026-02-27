import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin } from 'lucide-react';
import { ContainerModal } from './components/ContainerModal';

// Fix leaflet icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Container {
  id: string;
  fractie: string;
  lat: number;
  lng: number;
}

interface GlobalStatus {
  [id: string]: { status: 'Full' | 'Empty'; timestamp: string };
}

const AMSTERDAM_CENTER: [number, number] = [52.3676, 4.9041];

const CATEGORIES = ['Rest', 'Papier', 'Glas', 'Textiel', 'Groente-, fruit-, etensresten en tuinafval (gfe/t)'];

const createCustomIcon = (status: 'Full' | 'Empty' | 'Unknown') => {
  let statusClass = '';
  if (status === 'Full') statusClass = 'status-full';
  if (status === 'Empty') statusClass = 'status-empty';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class='marker-pin ${statusClass}'></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
};

function createClusterCustomIcon(cluster: any) {
  return L.divIcon({
    html: `<span>${cluster.getChildCount()}</span>`,
    className: 'custom-cluster-icon',
    iconSize: L.point(40, 40, true),
  });
}

function App() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [globalStatus, setGlobalStatus] = useState<GlobalStatus>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string>('Rest');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [containersRes, statusRes] = await Promise.all([
          fetch('/containers.json'),
          fetch('http://localhost:3001/api/status').catch(() => ({ ok: false, json: () => ({}) } as any))
        ]);

        if (containersRes.ok) {
          const data = await containersRes.json();
          setContainers(data);
        }

        if (statusRes.ok) {
          const statuses = await statusRes.json();
          setGlobalStatus(statuses);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll for status updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/status');
        if (res.ok) {
          const statuses = await res.json();
          setGlobalStatus(statuses);
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
      if (activeCategory && c.fractie !== activeCategory && activeCategory !== 'All') return false;
      if (searchQuery) {
        // Super simple search by ID for now since zip codes require geocoding
        // In a real app we would use a geocoding API to pan the map to a zip code
        if (!c.id.includes(searchQuery)) return false;
      }
      return true;
    });
  }, [containers, activeCategory, searchQuery]);

  const handleStatusUpdated = (status: 'Full' | 'Empty') => {
    if (selectedContainer) {
      setGlobalStatus(prev => ({
        ...prev,
        [selectedContainer.id]: { status, timestamp: new Date().toISOString() }
      }));
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2>Loading Amsterdam Maps...</h2>
      </div>
    );
  }

  return (
    <>
      <MapContainer
        center={AMSTERDAM_CENTER}
        zoom={13}
        zoomControl={false} // Custom zoom position via CSS
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
        >
          {filteredContainers.map(container => {
            const status = globalStatus[container.id]?.status || 'Unknown';
            return (
              <Marker
                key={container.id}
                position={[container.lat, container.lng]}
                icon={createCustomIcon(status)}
                eventHandlers={{
                  click: () => setSelectedContainer(container)
                }}
              />
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Floating Glass UI overlay */}
      <div className="glass-panel app-header">
        <div className="app-title">
          <MapPin className="icon" size={28} />
          <span>Amsterdam Afval</span>
        </div>

        <div className="search-box">
          <Search size={20} color="#999" />
          <input
            type="text"
            placeholder="Search Container ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="categories">
          <div
            className={`category-chip ${activeCategory === 'All' ? 'active' : ''}`}
            onClick={() => setActiveCategory('All')}
          >
            All
          </div>
          {CATEGORIES.map(cat => (
            <div
              key={cat}
              className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.split(' ')[0]} {/* Shorten long names */}
            </div>
          ))}
        </div>
      </div>

      {selectedContainer && (
        <ContainerModal
          container={selectedContainer}
          onClose={() => setSelectedContainer(null)}
          onStatusUpdated={handleStatusUpdated}
          globalStatus={globalStatus}
        />
      )}
    </>
  );
}

export default App;
