import sqlite3
import os

DB_FILE = "processos.db"

def migrate():
    print(f"Iniciando migração do banco de dados: {DB_FILE}")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. Criação da tabela clientes
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT CHECK(tipo IN ('Física', 'Jurídica')),
            cpf_cnpj TEXT UNIQUE NOT NULL,
            email TEXT,
            telefone TEXT,
            cep TEXT,
            logradouro TEXT,
            numero TEXT,
            complemento TEXT,
            bairro TEXT,
            cidade TEXT,
            estado TEXT,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Tabela 'clientes' criada ou já existente.")

    # 2. Verificação se a coluna cliente_id já existe na tabela processos
    cursor.execute("PRAGMA table_info(processos)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "cliente_id" not in columns:
        try:
            cursor.execute("ALTER TABLE processos ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL")
            print("Coluna 'cliente_id' adicionada à tabela 'processos'.")
        except sqlite3.OperationalError as e:
            print(f"Erro ao adicionar coluna 'cliente_id' (pode já existir): {e}")
    else:
        print("Coluna 'cliente_id' já existe na tabela 'processos'.")

    # 3. Criar uma tabela de log de migrações ou apenas commitar
    conn.commit()
    conn.close()
    print("Migração concluída com sucesso!")

if __name__ == "__main__":
    migrate()
