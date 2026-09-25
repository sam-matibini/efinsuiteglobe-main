
-- Temporarily disable the posted-entry modification trigger to fix broken JE-0005 data
ALTER TABLE public.journal_entry_lines DISABLE TRIGGER trigger_prevent_posted_line_modification;

-- Update customer_id on 18 credit lines of JE-0005 (ea271b6b-58d3-4af6-adc2-1d06d8a84597)
UPDATE public.journal_entry_lines SET customer_id = '7f752e0f-7b61-4b87-b241-3c62b3747067' WHERE id = '0afde9fb-b37b-4c9c-8b00-556484804d24';
UPDATE public.journal_entry_lines SET customer_id = '3b5e4d50-c2c0-408a-8c6c-2259762ba704' WHERE id = 'af7067d3-e035-43ce-a943-12a4a3e0a37a';
UPDATE public.journal_entry_lines SET customer_id = '67964f43-89a9-498d-8416-cb612715c6d0' WHERE id = '3c7afa63-70a0-4126-a022-6597a962f8d6';
UPDATE public.journal_entry_lines SET customer_id = '26c0da4b-0e09-4967-913e-3371036a0bbf' WHERE id = '1fa6a413-baef-4883-abed-9a9aab1baa77';
UPDATE public.journal_entry_lines SET customer_id = '6c03f250-43d7-4287-a97f-f8799536091d' WHERE id = '9c240ff7-f19b-4851-8a40-b4b2bfd9f542';
UPDATE public.journal_entry_lines SET customer_id = '02ecf38e-67ef-4562-ba65-e9414a86ecf5' WHERE id = '42cfbcf4-0a15-4b2c-9425-048735507e31';
UPDATE public.journal_entry_lines SET customer_id = '801b1df5-c062-4be9-8ab2-474952afa0a0' WHERE id = 'af9bb29f-fe8a-467b-a574-c97bc4747b98';
UPDATE public.journal_entry_lines SET customer_id = 'b3428084-9e7c-4d0f-a358-f71d12303700' WHERE id = '962e1c2a-b278-4f35-82a6-7dda10c253c1';
UPDATE public.journal_entry_lines SET customer_id = '404130a2-b425-4d51-866c-23839b0683c7' WHERE id = 'b66b6923-862f-406c-b99b-4a7a67071af8';
UPDATE public.journal_entry_lines SET customer_id = 'b4b94d58-c49e-42d7-812a-905ddafbdaf8' WHERE id = '2f3f6724-3543-4458-ba49-9a5b0edce4dd';
UPDATE public.journal_entry_lines SET customer_id = 'a980f39a-7954-4a8e-85d9-542c63e67236' WHERE id = '20316492-8e73-4869-984b-2eba685bccf2';
UPDATE public.journal_entry_lines SET customer_id = '57068cff-4d91-4b0c-93e4-c09b133a3676' WHERE id = '3b56e872-1a6c-4131-9c72-e45323c00e10';
UPDATE public.journal_entry_lines SET customer_id = 'ccfd3690-b1cc-4584-a9bd-c6f71b3e3309' WHERE id = '32584bc2-4d4f-4bc8-bf41-5135b7e42882';
UPDATE public.journal_entry_lines SET customer_id = 'a15db85d-01c5-48ef-83c0-a928f606008d' WHERE id = '81daf056-9230-492b-8383-938e03db1127';
UPDATE public.journal_entry_lines SET customer_id = '5e4c3a63-3279-4eb8-92a3-5312c299dd81' WHERE id = '325036e1-d9ca-4de9-9249-ba22e39742d1';
UPDATE public.journal_entry_lines SET customer_id = '741b73b4-7460-45e3-9f05-68626fa55904' WHERE id = '7cad1d3b-f059-49e3-92b0-8aae906c063d';
UPDATE public.journal_entry_lines SET customer_id = '1e9a23b4-f3e7-4dc1-8ad1-4eaf2c01007e' WHERE id = 'e54ed6b5-1996-4cb4-9ab4-5d99744cbbdf';
UPDATE public.journal_entry_lines SET customer_id = '66c21780-9b81-4544-9052-43729c4047ba' WHERE id = '18d4098c-02cb-44b9-abde-5852adbfe8ba';

-- Re-enable the trigger
ALTER TABLE public.journal_entry_lines ENABLE TRIGGER trigger_prevent_posted_line_modification;

-- Insert 18 donation records (DON-00043 through DON-00060)
INSERT INTO public.donations (organization_id, donation_number, donor_id, date_received, amount, currency, donation_type, journal_entry_id, eligible_amount, advantage_value, notes, status, confirmed_at) VALUES
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00043', '7f752e0f-7b61-4b87-b241-3c62b3747067', '2025-12-30', 1445.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 1445.00, 0, 'BAHATI MULIMBWA - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00044', '3b5e4d50-c2c0-408a-8c6c-2259762ba704', '2025-12-30', 131.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 131.00, 0, 'AMOS GICHO - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00045', '67964f43-89a9-498d-8416-cb612715c6d0', '2025-12-30', 219.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 219.00, 0, 'DANIEL USHINDI SAFARI - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00046', '26c0da4b-0e09-4967-913e-3371036a0bbf', '2025-12-30', 125.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 125.00, 0, 'Esperance Chiba Safari - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00047', '6c03f250-43d7-4287-a97f-f8799536091d', '2025-12-30', 40.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 40.00, 0, 'Noelly Mulimbwa - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00048', '02ecf38e-67ef-4562-ba65-e9414a86ecf5', '2025-12-30', 80.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 80.00, 0, 'SHUKURU NALUOLO MIRIELLE - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00049', '801b1df5-c062-4be9-8ab2-474952afa0a0', '2025-12-30', 55.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 55.00, 0, 'ELIE BARAKA SAFARI - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00050', 'b3428084-9e7c-4d0f-a358-f71d12303700', '2025-12-30', 10.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 10.00, 0, 'SANDRA KAYEYE - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00051', '404130a2-b425-4d51-866c-23839b0683c7', '2025-12-30', 50.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 50.00, 0, 'BIKYEOMBE MAUA THEREZE - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00052', 'b4b94d58-c49e-42d7-812a-905ddafbdaf8', '2025-12-30', 20.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 20.00, 0, 'Mapendo Furaha - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00053', 'a980f39a-7954-4a8e-85d9-542c63e67236', '2025-12-30', 25.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 25.00, 0, 'WIVINE NGOY - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00054', '57068cff-4d91-4b0c-93e4-c09b133a3676', '2025-12-30', 50.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 50.00, 0, 'FILLY MALALAKO - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00055', 'ccfd3690-b1cc-4584-a9bd-c6f71b3e3309', '2025-12-30', 780.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 780.00, 0, 'PETER BUHENDWE - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00056', 'a15db85d-01c5-48ef-83c0-a928f606008d', '2025-12-30', 10.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 10.00, 0, 'EXODE BIZIMANA - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00057', '5e4c3a63-3279-4eb8-92a3-5312c299dd81', '2025-12-30', 5.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 5.00, 0, 'MIKITI BARTELEMIE - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00058', '741b73b4-7460-45e3-9f05-68626fa55904', '2025-12-30', 30.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 30.00, 0, 'Laetitia Cubahiro - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00059', '1e9a23b4-f3e7-4dc1-8ad1-4eaf2c01007e', '2025-12-30', 5.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 5.00, 0, 'Victor Safari - JE-0005 correction', 'confirmed', NOW()),
('71e20394-1180-4f26-a0a9-59f00ec9d5ca', 'DON-00060', '66c21780-9b81-4544-9052-43729c4047ba', '2025-12-30', 66.00, 'CAD', 'cash', 'ea271b6b-58d3-4af6-adc2-1d06d8a84597', 66.00, 0, 'ADAWONU KAMLAN - JE-0005 correction', 'confirmed', NOW());
