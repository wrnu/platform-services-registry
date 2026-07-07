'use client';

import { Button } from '@mantine/core';
import { IconCloudDownload } from '@tabler/icons-react';
import { useState } from 'react';
import { openNotificationModal } from '@/components/modal/notification';
import { instance } from '@/services/backend/axios';
import { downloadFile } from '@/utils/browser';
import { cn } from '@/utils/js';

export default function ExportButton({
  onExport,
  className = '',
  downloadUrl,
}: {
  onExport?: () => Promise<boolean>;
  className?: string;
  downloadUrl?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const openNoContentModal = async () => {
    await openNotificationModal(
      { content: 'There is no data available for download.' },
      {
        settings: {
          title: 'Nothing to export',
          withCloseButton: true,
          closeOnClickOutside: true,
          closeOnEscape: true,
        },
      },
    );
  };

  return (
    <>
      <Button
        color="dark"
        variant="outline"
        leftSection={<IconCloudDownload />}
        className={cn('pr-6', className)}
        loading={isLoading}
        onClick={async () => {
          if (onExport) {
            setIsLoading(true);
            const success = await onExport();
            if (!success) {
              await openNoContentModal();
            }
            setIsLoading(false);
          } else if (downloadUrl) {
            setIsLoading(true);
            const defaultName = downloadUrl.includes('format=csv') ? 'data.csv' : 'data.xlsx';
            const success = await instance.get(downloadUrl, { responseType: 'blob' }).then((res) => {
              if (res.status === 204) return false;
              const disposition = res.headers?.['content-disposition'] as string | undefined;
              const match = disposition?.match(/filename=([^;]+)/);
              const filename = match?.[1]?.trim() ?? defaultName;
              downloadFile(res.data, filename, res.headers);
              return true;
            });

            if (!success) {
              await openNoContentModal();
            }
            setIsLoading(false);
          }
        }}
      >
        Export
      </Button>
    </>
  );
}
