-- First add the new enum values to module_type
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'docsign';
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'communication';
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'accountant_dashboard';