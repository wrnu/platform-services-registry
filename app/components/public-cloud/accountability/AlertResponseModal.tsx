'use client';

import { Button, Modal, Textarea } from '@mantine/core';
import { useState } from 'react';
import { acknowledgePublicCloudAlert, resolvePublicCloudAlert } from '@/services/backend/public-cloud/accountability';

export default function AlertResponseModal({
  licencePlate,
  alertId,
  alertLevel,
  mode,
  opened,
  onClose,
  onComplete,
}: {
  licencePlate: string;
  alertId: string;
  alertLevel: string;
  mode: 'acknowledge' | 'resolve';
  opened: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [explanation, setExplanation] = useState('');
  const [resolutionReason, setResolutionReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === 'acknowledge') {
        await acknowledgePublicCloudAlert(licencePlate, alertId, explanation || undefined);
      } else {
        await resolvePublicCloudAlert(
          licencePlate,
          alertId,
          resolutionReason || 'Resolved by project team',
          explanation || undefined,
        );
      }
      setExplanation('');
      setResolutionReason('');
      onComplete();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'acknowledge' ? `Acknowledge ${alertLevel} alert` : `Resolve ${alertLevel} alert`}
    >
      <div className="space-y-4">
        <Textarea
          label="Explanation (optional)"
          description="Describe variance or planned forecast update"
          value={explanation}
          onChange={(e) => setExplanation(e.currentTarget.value)}
          minRows={3}
        />
        {mode === 'resolve' && (
          <Textarea
            label="Resolution reason"
            value={resolutionReason}
            onChange={(e) => setResolutionReason(e.currentTarget.value)}
            minRows={2}
          />
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            {mode === 'acknowledge' ? 'Acknowledge' : 'Resolve'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
