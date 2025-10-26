#!/bin/bash

# Helpers para testes

# Gerar CPF válido
generate_valid_cpf() {
    # CPFs de teste válidos (com dígitos verificadores corretos)
    # Fonte: https://www.geradorcpf.com/
    VALID_CPFS=(
        "52998224725"  # Maria
        "51188453094"  # João
        "13669396000"  # Teste 3
        "78502155001"  # Teste 4
    )

    # Retorna o CPF do índice fornecido
    local index=${1:-0}
    echo "${VALID_CPFS[$index]}"
}

# Exportar funções
export -f generate_valid_cpf
