from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import IssuedCertificate


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_certificates(request):
    """List all certificates issued to the logged-in user."""
    certs = IssuedCertificate.objects.filter(
        user=request.user
    ).select_related('template').order_by('-issued_at')

    results = []
    for c in certs:
        results.append({
            'id': c.pk,
            'template_title': c.template.title,
            'template_description': c.template.description,
            'pdf_url': request.build_absolute_uri(c.generated_pdf.url) if c.generated_pdf else None,
            'issued_at': c.issued_at.isoformat(),
            'issued_by': c.issued_by_name,
        })

    return Response({'success': True, 'certificates': results})
