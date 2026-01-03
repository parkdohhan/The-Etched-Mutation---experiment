-- TEM Phase 1: 쪽지 시스템을 위한 notes 테이블 생성
-- 트루엔딩 달성 시 체험자가 기록자에게 보내는 익명 메시지

CREATE TABLE IF NOT EXISTS notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    sender_session_id UUID,  -- 익명 유지를 위해 세션 ID만 저장
    recipient_user_id UUID,  -- 기록자의 user ID
    message TEXT NOT NULL CHECK (char_length(message) <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_notes_recipient ON notes(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notes_memory ON notes(memory_id);

-- RLS 정책 설정
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 누구나 쪽지 삽입 가능 (익명)
CREATE POLICY "Anyone can insert notes"
    ON notes
    FOR INSERT
    TO public
    WITH CHECK (true);

-- 수신자만 쪽지 조회 가능
CREATE POLICY "Recipients can view their notes"
    ON notes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = recipient_user_id);

-- 수신자만 읽음 처리 가능
CREATE POLICY "Recipients can mark notes as read"
    ON notes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = recipient_user_id)
    WITH CHECK (auth.uid() = recipient_user_id);

COMMENT ON TABLE notes IS '트루엔딩 달성자가 기록자에게 보내는 익명 쪽지';
COMMENT ON COLUMN notes.message IS '최대 100자, 1회만 전송 가능, 답장 불가';
