'use client';

import { IconButton, Tooltip, type IconButtonProps } from '@mui/material';
import { headerActionSx, type HeaderChromeTone } from './headerUi';
import { useTheme } from '@mui/material/styles';

interface HeaderActionButtonProps extends Omit<IconButtonProps, 'size'> {
  title: string;
  tone?: HeaderChromeTone;
}

export default function HeaderActionButton({ title, tone = 'light', children, sx, ...rest }: HeaderActionButtonProps) {
  const theme = useTheme();
  return (
    <Tooltip title={title}>
      <IconButton size="small" sx={{ ...headerActionSx(theme, tone), ...sx }} {...rest}>
        {children}
      </IconButton>
    </Tooltip>
  );
}
