import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/hooks/useFileConvert', () => ({
  useFileConvert: () => ({ convertFile: vi.fn(), isConverting: false }),
}));

vi.mock('@/hooks/usePdfToSpreadsheet', () => ({
  usePdfToSpreadsheet: () => ({ convertPdfToSpreadsheet: vi.fn(), isConverting: false, progress: null, error: null }),
}));

vi.mock('@/hooks/useAliceTTS', () => ({
  useAliceTTS: () => ({
    speak: vi.fn(), pause: vi.fn(), resume: vi.fn(), stop: vi.fn(), replay: vi.fn(),
    isSpeaking: false, isPaused: false, isLoading: false,
  }),
}));

vi.mock('@/hooks/useAliceShare', () => ({
  useAliceShare: () => ({
    shareViaEmail: vi.fn(), shareViaSMS: vi.fn(), shareViaWhatsApp: vi.fn(), shareViaGoogleChat: vi.fn(),
    downloadAsPDF: vi.fn(), downloadAsExcel: vi.fn(), downloadAsWord: vi.fn(), downloadAsText: vi.fn(), copyToClipboard: vi.fn(),
  }),
}));

vi.mock('@/hooks/useBankAccounts', () => ({ useBankAccounts: () => ({ accounts: [] }) }));
vi.mock('@/hooks/useCreditCards', () => ({
  useCreditCards: () => ({ creditCards: [] }),
  useCreditCardTransactions: () => ({ importTransactions: vi.fn() }),
}));
vi.mock('@/hooks/useBankTransactions', () => ({ useBankTransactions: () => ({ importTransactions: vi.fn() }) }));
vi.mock('@/components/banking/TemplateManagementPanel', () => ({ TemplateManagementPanel: () => <div>Templates</div> }));
vi.mock('./AISheets', () => ({ AISheets: () => null }));
vi.mock('./AIFinancialToolkit', () => ({ AIFinancialToolkit: () => null }));
vi.mock('@/components/banking/StatementExtractionDialog', () => ({ StatementExtractionDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { AIAccountingAssistant } from './AIAccountingAssistant';

describe('Alice AI Receptionist entry', () => {
  it('offers the receptionist and opens the desk', () => {
    const onOpenChange = vi.fn();
    render(<AIAccountingAssistant isOpen onOpenChange={onOpenChange} />);

    expect(screen.getByRole('button', { name: 'Open AI Receptionist' })).toBeInTheDocument();
    expect(screen.getByText(/Answers calls with ElevenLabs/)).toBeInTheDocument();
    expect(screen.getByText('Open the AI Receptionist and take a payroll call')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open AI Receptionist desk' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith('/receptionist');
  });

  it('opens the desk when asked to answer the phone', () => {
    const onOpenChange = vi.fn();
    render(<AIAccountingAssistant isOpen onOpenChange={onOpenChange} />);
    const box = screen.getByPlaceholderText(/Ask a question/);
    fireEvent.change(box, { target: { value: 'Please answer the phone' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith('/receptionist');
  });
});
