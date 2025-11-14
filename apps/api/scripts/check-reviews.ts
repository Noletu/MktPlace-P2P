import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReviews() {
  console.log('🔍 Verificando reviews no banco de dados...\n');

  // Buscar todas as reviews
  const reviews = await prisma.review.findMany({
    include: {
      reviewer: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      reviewed: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      order: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  console.log(`📊 Total de reviews encontradas: ${reviews.length}\n`);

  if (reviews.length === 0) {
    console.log('❌ Nenhuma review encontrada no banco de dados!\n');
    return;
  }

  // Mostrar cada review
  reviews.forEach((review, index) => {
    console.log(`\n${index + 1}. Review ID: ${review.id}`);
    console.log(`   Avaliador: ${review.reviewer.name || review.reviewer.email} (${review.reviewer.id})`);
    console.log(`   Avaliado: ${review.reviewed.name || review.reviewed.email} (${review.reviewed.id})`);
    console.log(`   Ordem: ${review.orderId} (Status: ${review.order.status})`);
    console.log(`   Rating Geral: ${review.rating} ⭐`);
    console.log(`   Confiabilidade: ${review.reliabilityRating || 'N/A'}`);
    console.log(`   Comunicação: ${review.communicationRating || 'N/A'}`);
    console.log(`   Rapidez: ${review.speedRating || 'N/A'}`);
    console.log(`   Comentário: ${review.comment ? review.comment.substring(0, 50) + '...' : 'Sem comentário'}`);
    console.log(`   Oculta: ${review.isHidden ? '❌ SIM' : '✅ NÃO'}`);
    console.log(`   Suspeita: ${review.isSuspicious ? '⚠️ SIM' : '✅ NÃO'}`);
    console.log(`   Criada em: ${review.createdAt.toISOString()}`);
  });

  // Agrupar por reviewedId (quem foi avaliado)
  console.log('\n\n📊 Reviews por usuário avaliado:');
  const reviewsByReviewed = reviews.reduce((acc: any, review) => {
    if (!acc[review.reviewedId]) {
      acc[review.reviewedId] = {
        user: review.reviewed,
        reviews: [],
      };
    }
    acc[review.reviewedId].reviews.push(review);
    return acc;
  }, {});

  Object.entries(reviewsByReviewed).forEach(([userId, data]: [string, any]) => {
    console.log(`\n👤 ${data.user.name || data.user.email} (${userId})`);
    console.log(`   Total de reviews recebidas: ${data.reviews.length}`);
    const avgRating = data.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / data.reviews.length;
    console.log(`   Média: ${avgRating.toFixed(2)} ⭐`);
  });

  console.log('\n✅ Verificação concluída!\n');
}

checkReviews()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
