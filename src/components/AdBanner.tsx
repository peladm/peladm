'use client';

interface AdBannerProps {
  position?: 'top' | 'bottom';
}

export default function AdBanner({ position = 'bottom' }: AdBannerProps) {
  void position;
  return null;
}
