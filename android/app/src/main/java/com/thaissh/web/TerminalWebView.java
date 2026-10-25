package com.thaissh.web;

import android.content.Context;
import android.text.InputType;
import android.util.AttributeSet;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;

import com.getcapacitor.CapacitorWebView;

/**
 * WebView ที่บอก IME ว่า "ไม่ต้องเดาคำ" (TYPE_TEXT_FLAG_NO_SUGGESTIONS แบบเดียวกับ TerminalView ของแอปเดิม)
 * ไม่งั้นคีย์บอร์ด Samsung/Gboard จะประสมคำภาษาอังกฤษค้างไว้ (composing) ทำให้ Ctrl/Alt แบบค้าง,
 * Enter และปุ่มพิเศษบนแถบปุ่มรวนเพราะ xterm ได้ตัวอักษรช้า/ซ้ำ
 */
public class TerminalWebView extends CapacitorWebView {

    public TerminalWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection ic = super.onCreateInputConnection(outAttrs);
        if ((outAttrs.inputType & InputType.TYPE_MASK_CLASS) == InputType.TYPE_CLASS_TEXT) {
            outAttrs.inputType = (outAttrs.inputType
                & ~(InputType.TYPE_TEXT_FLAG_AUTO_CORRECT | InputType.TYPE_TEXT_FLAG_AUTO_COMPLETE))
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS;
        }
        outAttrs.imeOptions |= EditorInfo.IME_FLAG_NO_EXTRACT_UI | EditorInfo.IME_FLAG_NO_FULLSCREEN;
        return ic;
    }
}
