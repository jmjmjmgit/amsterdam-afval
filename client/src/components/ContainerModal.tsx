import React, { useState } from 'react';
import { X, CheckCircle, AlertOctagon, Info, AlertTriangle } from 'lucide-react';

interface Container {
    id: string;
    fractie: string;
    lat: number;
    lng: number;
}

interface Status {
    status: 'Full' | 'Empty';
    timestamp: string;
}

interface ModalProps {
    container: Container;
    onClose: () => void;
    onStatusUpdated: (status: 'Full' | 'Empty') => void;
    globalStatus: Record<string, Status>;
}

export const ContainerModal: React.FC<ModalProps> = ({ container, onClose, onStatusUpdated, globalStatus }) => {
    const [loading, setLoading] = useState(false);

    // Use global status if available
    const currentStatus = globalStatus[container.id];

    const handleReport = async (status: 'Full' | 'Empty') => {
        setLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_BASE}/api/status/${container.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                onStatusUpdated(status);
            } else {
                alert('Failed to update status. Server responded with an error.');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to update status. Is backend running?');
        } finally {
            setLoading(false);
        }
    };

    const getStatusDisplay = () => {
        if (!currentStatus) return { label: 'Status Unknown', class: 'unknown', icon: <Info size={20} /> };
        if (currentStatus.status === 'Full') return { label: 'Reported Full', class: 'full', icon: <AlertTriangle size={20} /> };
        return { label: 'Reported Not Full', class: 'not-full', icon: <CheckCircle size={20} /> };
    };

    const display = getStatusDisplay();
    const timeStr = currentStatus ? new Date(currentStatus.timestamp).toLocaleString() : '';

    return (
        <div className="glass-panel modal-overlay">
            <div className="modal-header">
                <div className="modal-title">
                    <h2>{container.fractie || 'Afvalcontainer'}</h2>
                    <p>Container ID: {container.id}</p>
                </div>
                <button className="close-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
            </div>

            <div className={`status-indicator ${display.class}`}>
                {display.icon}
                <div>
                    <div>{display.label}</div>
                    {timeStr && <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 400 }}>Last update: {timeStr}</div>}
                </div>
            </div>

            <div className="action-buttons">
                <button
                    className="btn btn-primary"
                    onClick={() => handleReport('Empty')}
                    disabled={loading}
                >
                    <CheckCircle size={18} />
                    Looks Empty
                </button>
                <button
                    className="btn btn-danger"
                    onClick={() => handleReport('Full')}
                    disabled={loading}
                >
                    <AlertOctagon size={18} />
                    Report Full
                </button>
            </div>
        </div>
    );
};
