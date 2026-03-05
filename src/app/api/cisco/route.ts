import { NextRequest, NextResponse } from 'next/server';
import { executeCommand, getPrompt } from '@/lib/cisco/executor';
import { SwitchState, CommandMode } from '@/lib/cisco/types';
import { createInitialState } from '@/lib/cisco/initialState';

// Global state storage (in-memory, per session would be better but this is a demo)
let switchState: SwitchState = createInitialState();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, state } = body;

    // Eğer state gönderildiyse, onu kullan
    if (state) {
      switchState = state;
    }

    if (!command) {
      return NextResponse.json({ 
        error: 'Komut gerekli' 
      }, { status: 400 });
    }

    // Komutu çalıştır
    const result = executeCommand(switchState, command);

    // State'i güncelle
    if (result.success && result.newState) {
      switchState = {
        ...switchState,
        ...result.newState
      };
    }

    // Komut geçmişine ekle
    if (command.trim() && !command.trim().startsWith('?')) {
      switchState.commandHistory = [
        ...switchState.commandHistory.slice(-49), // Son 50 komut
        command.trim()
      ];
    }

    return NextResponse.json({
      success: result.success,
      output: result.output,
      error: result.error,
      state: switchState,
      prompt: getPrompt(switchState)
    });

  } catch (error) {
    console.error('Cisco API Error:', error);
    return NextResponse.json({ 
      error: 'Sunucu hatası oluştu' 
    }, { status: 500 });
  }
}

export async function GET() {
  // Mevcut state'i getir
  return NextResponse.json({
    state: switchState,
    prompt: getPrompt(switchState)
  });
}

// State sıfırlama
export async function DELETE() {
  switchState = createInitialState();
  return NextResponse.json({
    success: true,
    message: 'Switch durumu sıfırlandı',
    state: switchState,
    prompt: getPrompt(switchState)
  });
}
