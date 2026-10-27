import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';

export default function Mock() {
  const { navigate } = useAppStore();

  useEffect(() => {
    navigate('home');
  }, [navigate]);

  return null;
}
