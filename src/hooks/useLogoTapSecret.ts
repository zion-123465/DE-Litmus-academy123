import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Secret admin entry: tap the logo 4 times within 2.5 seconds
// to open the hidden admin login.
export function useLogoTapSecret() {
  const navigate = useNavigate();
  const tapsRef = useRef<number[]>([]);

  const onLogoTap = useCallback(() => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 2500), now];
    if (tapsRef.current.length >= 4) {
      tapsRef.current = [];
      navigate('/admin-portal-x7k9/login');
    }
  }, [navigate]);

  return onLogoTap;
}
