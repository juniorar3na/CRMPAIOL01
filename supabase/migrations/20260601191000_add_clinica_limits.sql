-- Adiciona limites de uso para as clínicas controlados pelo Super Admin
ALTER TABLE public.clinicas ADD COLUMN limite_whatsapp INT NOT NULL DEFAULT 1;
ALTER TABLE public.clinicas ADD COLUMN limite_unidades INT NOT NULL DEFAULT 1;
